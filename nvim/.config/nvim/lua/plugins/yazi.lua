-- yazi file manager inside nvim. <leader>- opens yazi at the current file.
-- Note: do NOT also enable LazyVim's yazi extra — it causes a double-picker conflict.
return {
  "mikavilpas/yazi.nvim",
  event = "VeryLazy",
  dependencies = { { "nvim-lua/plenary.nvim", lazy = true } },
  keys = {
    { "<leader>-", "<cmd>Yazi<cr>", desc = "Open yazi at the current file" },
    { "<leader>cw", "<cmd>Yazi cwd<cr>", desc = "Open yazi in working directory" },
  },
  opts = {
    open_for_directories = false,
  },
}
