-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
--
-- Add any additional autocmds here
-- with `vim.api.nvim_create_autocmd`
--
-- Or remove existing autocmds by their group name (which is prefixed with `lazyvim_` for the defaults)
-- e.g. vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")

-- ---------------------------------------------------------------------------
-- Live-reload markdown buffers edited by an external process (e.g. an AI agent)
-- and push the reload to the markdown-preview.nvim browser tab.
--
-- LazyVim only runs :checktime on FocusGained, so an agent writing the file
-- while the terminal is unfocused never reloads the buffer. This watches the
-- file's directory with libuv and calls :checktime as soon as the file changes.
-- markdown-preview.nvim only refreshes on cursor movement, so after the buffer
-- is reloaded (FileChangedShellPost) we explicitly ask it to refresh.
-- ---------------------------------------------------------------------------
vim.opt.autoread = true

local group = vim.api.nvim_create_augroup("markdown_live_reload", { clear = true })
local watchers = {} -- bufnr -> { handle = uv_fs_event_t, timer = uv_timer_t, path = string }

local function stop_watch(buf)
  local w = watchers[buf]
  if not w then
    return
  end
  watchers[buf] = nil
  if w.timer and not w.timer:is_closing() then
    w.timer:stop()
    w.timer:close()
  end
  if w.handle and not w.handle:is_closing() then
    w.handle:stop()
    w.handle:close()
  end
end

local function refresh_preview(buf)
  -- Only once markdown-preview.nvim has been loaded by lazy.nvim. The autoload
  -- function is a no-op when no preview server is running, so it's safe to call.
  if vim.fn.exists(":MarkdownPreview") ~= 2 then
    return
  end
  -- preview_refresh() uses bufnr('%'), so run it with `buf` as the current buffer.
  pcall(vim.api.nvim_buf_call, buf, function()
    vim.fn["mkdp#rpc#preview_refresh"]()
  end)
end

local function start_watch(buf)
  local path = vim.api.nvim_buf_get_name(buf)
  if path == "" or vim.fn.filereadable(path) == 0 then
    stop_watch(buf)
    return
  end
  local w = watchers[buf]
  if w and w.path == path then
    return -- already watching this file
  end
  stop_watch(buf)

  local dir = vim.fs.dirname(path)
  local name = vim.fs.basename(path)
  local handle = vim.uv.new_fs_event()
  local timer = vim.uv.new_timer()
  if not handle or not timer then
    return
  end
  watchers[buf] = { handle = handle, timer = timer, path = path }

  -- Watch the directory rather than the file so atomic writes (write to temp,
  -- rename over the original) are still detected.
  handle:start(dir, {}, function(err, fname)
    if err or (fname and fname ~= name) then
      return
    end
    -- Debounce: agents often write in bursts.
    timer:stop()
    timer:start(
      100,
      0,
      vim.schedule_wrap(function()
        if not vim.api.nvim_buf_is_valid(buf) then
          stop_watch(buf)
          return
        end
        -- Never clobber unsaved edits; LazyVim's FocusGained checktime will
        -- prompt about the conflict when you come back to the window.
        if vim.bo[buf].modified then
          return
        end
        vim.cmd("silent! checktime " .. buf)
      end)
    )
  end)
end

vim.api.nvim_create_autocmd("FileType", {
  group = group,
  pattern = "markdown",
  callback = function(ev)
    start_watch(ev.buf)
  end,
})

-- Re-arm when the buffer is written under a new name (:saveas, rename).
vim.api.nvim_create_autocmd({ "BufFilePost", "BufWritePost" }, {
  group = group,
  pattern = "*.md",
  callback = function(ev)
    if vim.bo[ev.buf].filetype == "markdown" then
      start_watch(ev.buf)
    end
  end,
})

vim.api.nvim_create_autocmd({ "BufDelete", "BufWipeout" }, {
  group = group,
  callback = function(ev)
    stop_watch(ev.buf)
  end,
})

-- After Neovim reloads the buffer from disk, push the new content to the preview.
vim.api.nvim_create_autocmd("FileChangedShellPost", {
  group = group,
  callback = function(ev)
    if vim.bo[ev.buf].filetype == "markdown" then
      refresh_preview(ev.buf)
    end
  end,
})
