-- TokyoNight Storm for LazyVim — vibrant, matches Ghostty/herdr/prompt.
-- tokyonight.nvim ships with LazyVim, so no extra plugin download is needed.
return {
  {
    "folke/tokyonight.nvim",
    priority = 1000,
    opts = {
      style = "storm",
      transparent = false,
      styles = {
        comments = { italic = true },
        keywords = { italic = true },
      },
    },
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "tokyonight-storm",
    },
  },
}
