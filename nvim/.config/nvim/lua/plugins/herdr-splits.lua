-- Seamless Ctrl-hjkl navigation and Alt-hjkl resize across herdr panes <-> nvim
-- splits. Only loads inside a herdr-managed pane (HERDR_ENV=1); outside herdr,
-- LazyVim's default Ctrl-hjkl window navigation stays in effect.
local function nav(dir)
  return function() require("herdr-splits")["move_cursor_" .. dir]() end
end
local function resize(dir)
  return function() require("herdr-splits")["resize_" .. dir]() end
end
-- From a terminal buffer, drop out of insert first so the move lands.
local function tnav(dir)
  return function()
    vim.cmd.stopinsert()
    require("herdr-splits")["move_cursor_" .. dir]()
  end
end

return {
  {
    "lmilojevicc/herdr-splits.nvim",
    cond = vim.env.HERDR_ENV == "1",
    event = "VeryLazy",
    opts = {
      default_amount = 0.03,
      neovim_amount = 3,
      at_edge = "wrap",
      unzoom_on_nav = true,
      auto_sync_herdr = true,
      ignored_buftypes = { "nofile", "quickfix", "prompt", "help", "terminal" },
    },
    keys = {
      { "<C-h>", nav("left"),  desc = "Navigate left (herdr/nvim)" },
      { "<C-j>", nav("down"),  desc = "Navigate down (herdr/nvim)" },
      { "<C-k>", nav("up"),    desc = "Navigate up (herdr/nvim)" },
      { "<C-l>", nav("right"), desc = "Navigate right (herdr/nvim)" },
      { "<M-h>", resize("left"),  desc = "Resize left (herdr/nvim)" },
      { "<M-j>", resize("down"),  desc = "Resize down (herdr/nvim)" },
      { "<M-k>", resize("up"),    desc = "Resize up (herdr/nvim)" },
      { "<M-l>", resize("right"), desc = "Resize right (herdr/nvim)" },
      { "<C-h>", tnav("left"),  mode = "t" },
      { "<C-j>", tnav("down"),  mode = "t" },
      { "<C-k>", tnav("up"),    mode = "t" },
      { "<C-l>", tnav("right"), mode = "t" },
    },
  },
}
