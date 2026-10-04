#===============================================================================
# Toggle Dashing Script
# By Nataxinus
#===============================================================================
#===============================================================================
# Description
# This is a must if you're planning on enabling dashing in your game! If the 
# player can move faster don't you think he would always? It is pointless to 
# hold down the button all the time. Instead with this script you can toggle 
# dashing on and off with a press of a button of your choosing.
# You can also modify the speed bonus granted when dashing.
#===============================================================================
#===============================================================================
# Terms of use
# Free for non-commercial and commercial projects, but credit me
#===============================================================================
module Nataxinus
  module ToggleDashing
    # Self explanatory
    DASH_BUTTON = :A
    # Dash bonus speed. Be warned, the hit detection might not be able to keep
    # up at incredibly high speeds. 
    DASH_SPEED = 1
  end
end
 
class Game_Player < Game_Character
  include Nataxinus::ToggleDashing
  alias dash_init initialize
  def initialize
    dash_init
    @dashing = false
  end
  
  def dash?
    return false if @move_route_forcing
    return false if $game_map.disable_dash?
    return false if vehicle
    if Input.trigger?(DASH_BUTTON) && !@dashing
      @dashing = true
    elsif Input.trigger?(DASH_BUTTON) && @dashing
      @dashing = false
    end
    return @dashing
  end
end
 
class Game_CharacterBase
  def real_move_speed
    @move_speed + (dash? ? Nataxinus::ToggleDashing::DASH_SPEED : 0)
  end
end