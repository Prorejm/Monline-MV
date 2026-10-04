#=================================================
# No battle Screen Tint
#--------------------------------------------

class Spriteset_Battle
  TINT_SWITCH = 0      #<--- Switch ID

  # If switch is ON, the battle will use the map's tint
  # If switch is OFF, the battle will not use a tint
  # You can also leave the switch ID at 0 to disable battle tints altogether.

  def update_viewports
          unless $game_switches[TINT_SWITCH]
          @viewport1.tone.set(0, 0, 0, 0)
          else
          @viewport1.tone.set($game_troop.screen.tone)
          end
        @viewport1.ox = $game_troop.screen.shake
        @viewport2.color.set($game_troop.screen.flash_color)
        @viewport3.color.set(0, 0, 0, 255 - $game_troop.screen.brightness)
        @viewport1.update
        @viewport2.update
        @viewport3.update
  end
end