################################################################################
#                                 DISABLE DASH                                 #
#                                  By: IXFURU                                  #
################################################################################
#                                                                              #
# Just credit me somewhere.  Use as you want.                                  #
#                                                                              #
# You can just make a script call saying "$game_player.no_dash = true" without #
# quotes to disable dashing. To enable it again, make a script call saying     #
# "$game_player.no_dash = false" without quotes.                               #
#                                                                              #
################################################################################
class Game_Player < Game_Character
  
  attr_writer :no_dash
  
  alias ds_gplayer_initialize initialize unless $@
  def initialize
    ds_gplayer_initialize
    @no_dash = false
  end
  
  alias ds_gplayer_dash? dash? unless $@
  def dash?
    return false if @no_dash
    ds_gplayer_dash?
  end
  
end