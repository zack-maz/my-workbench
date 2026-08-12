-- TokyoNight (night) with a black background to match the black terminal.
-- Vibrant syntax colors stay; only the backgrounds go near-black.
return {
  {
    "folke/tokyonight.nvim",
    priority = 1000,
    opts = {
      style = "night",
      on_colors = function(c)
        c.bg = "#0a0a0a"
        c.bg_dark = "#000000"
        c.bg_float = "#0a0a0a"
        c.bg_sidebar = "#0a0a0a"
        c.bg_statusline = "#0a0a0a"
      end,
      styles = {
        comments = { italic = true },
        keywords = { italic = true },
      },
    },
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "tokyonight-night",
    },
  },
}
