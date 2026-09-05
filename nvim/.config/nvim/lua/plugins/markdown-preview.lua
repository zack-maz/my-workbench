-- Live markdown preview in the browser. <leader>mp toggles it.
-- Build compiles the preview server via npm (node is at /opt/homebrew/bin).
return {
  {
    "iamcco/markdown-preview.nvim",
    cmd = { "MarkdownPreview", "MarkdownPreviewStop", "MarkdownPreviewToggle" },
    ft = { "markdown" },
    build = "cd app && /opt/homebrew/bin/npm install",
    keys = {
      { "<leader>mp", "<cmd>MarkdownPreviewToggle<cr>", desc = "Markdown Preview Toggle" },
    },
    init = function()
      vim.g.mkdp_port = ""
      vim.g.mkdp_auto_close = 0
      vim.g.mkdp_open_to_the_world = 0
      -- 0 = refresh the browser as the buffer changes (not only on save).
      -- Reloads from external edits are pushed by the FileChangedShellPost
      -- autocmd in lua/config/autocmds.lua.
      vim.g.mkdp_refresh_slow = 0
    end,
  },
}
