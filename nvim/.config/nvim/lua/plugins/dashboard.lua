-- Startup screen: Zima (Love, Death & Robots) in place of the LazyVim wordmark.
-- The full portrait, a tagline, and the plugin-load count. No command list.
-- Source art is images/cover-nobg.txt in the my-workbench repo.
--
-- Every art line is padded to exactly WIDTH. snacks aligns each header line on
-- its own (`formats.header = { "%s", align = "center" }`), which shears
-- asymmetric art apart; when a line's width equals the pane width, snacks'
-- align() returns early and the art passes through byte-for-byte. Padding
-- happens here at runtime rather than in the file below, so an editor stripping
-- trailing whitespace cannot quietly break the picture.
--
-- Renders as 39 lines, so it wants a 40-row window. Below that the top of the
-- head is the first thing to go.

local WIDTH = 64

-- Letter-spaced under the art. A terminal cannot scale a single line, so
-- tracking is the only lever here; colour stays NonText deliberately.
local TAGLINE = "o  f  f     t  h  e     g  r  i  d"

local ART = [[
                          @@@@@@%%%%
                         @@@@@@@@@%%%%
                        %@++%@@@@#=-.%
                         @:=%@@@@#=:.%
                         @.*@@@@@%=..%
                         @:*@@@*#....*
                        @--*@@@%%#*..=%
                        @++*+@@@@#====%
                         #+%@@@*@@@+.#
                          @#%%#=##@@%
                          @@#@%+--@@%
                          @@@@*+#@@%%
                         %@@@@@@@@@@%#
                      %%#*%@@@@@@@@@%#%##*
              @*%%%%###@@%@@@@@@@@@@@@%*#####+#####*
      @%%##*++=+-------*@@@@@@@@@@@@@@%+++++*=*###%##**++++++
 @#=-=-=--=+*#+====+*#%%@@@@@@@@@@@@@@@@%#*=+--+%%#+-.........=
 %.::=-=-=+****.-...:::-=*#@@@@@@@@@@@@%#+-:=::-**+==+-........*
@+-*****%#***#+:::::-:::::-=%@@@@@@@@@@@#+=-:::..-==+%@%*==+==.*
%==+#%@@@@@##*=-----::::-::-+%@#@@@@@@@%*=-:-:::::-#@@@@@%*#++.*
@*=*%@@@@@@%#*+---:::-::--:-+%@*#@@@%@@%*=-:::::=+#@@@@@@@%*#=.*
 %*#%@@@@@@@@@#*=--::-:::=-=#@@*+@@@%@@@**==+*##%@@@@@@@@@@%*=*
  %@@@@@@@@@@@@@@@%#*******%@@@%=*@@@@@@@@@@@@@@@@%# %%@@@%%##
   %##@@@@@  %@@@@@@@@@@@@@@%%%@%%@@@@@@@@@@@@@@%#   %%@@@%% #
   %#%@@@@%    %%@@@@@@@@#---=+@*===+#@@@@@@@@%%     %%@@@ % #
   ##%%@@@%       %@@@@@@+*#%%@@@%%%##%@@@@@%%       #%@@@ % #
   %##%@@@%         %@@@@###%%%@%%%@@@@@@@@%         #%@@@ # #
   % *%@@@@         %@@@@+**####**++++#@@@%%         #%@@@  ##
   %% @@@@%         %%@@@%@@@@@@@@@%%#@@@@%          #%@@@  #
    % @@@@%          %@@@#+****%######@@@@%          %%@@@  #
    % @@@@%          %@@@#=***#%#****+@@@%%          %%@@@% #
    % @@@@@          %@@@@+%%@@@@@%%%%@@@%%          #%@@@% #]]

---@return string the art, every line padded out to WIDTH
local function portrait()
  return table.concat(
    vim.tbl_map(function(line)
      return line .. string.rep(" ", math.max(0, WIDTH - vim.api.nvim_strwidth(line)))
    end, vim.split(ART, "\n", { plain = true })),
    "\n"
  )
end

return {
  "folke/snacks.nvim",
  opts = {
    dashboard = {
      width = WIDTH,
      preset = { header = portrait() },
      sections = {
        -- padding is { bottom, top } -- the 2 on the right is the gap that
        -- keeps the top of the head off the edge of the window.
        { header = portrait(), padding = { 2, 2 } },
        { text = { { TAGLINE, hl = "NonText", align = "center", width = WIDTH } }, padding = 1 },
        { section = "startup" },
      },
    },
  },
}
