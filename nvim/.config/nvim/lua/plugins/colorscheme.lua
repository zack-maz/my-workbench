-- Vesper for LazyVim — near-black background, warm minimal accents.
-- Matches Ghostty (theme = Vesper), herdr (theme = vesper), and the shell prompt.
return {
  {
    "datsfilipe/vesper.nvim",
    priority = 1000,
    opts = {
      transparent = false,
      italics = {
        comments = true,
        keywords = true,
        functions = false,
        strings = false,
        variables = false,
      },
    },
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "vesper",
    },
  },
}
