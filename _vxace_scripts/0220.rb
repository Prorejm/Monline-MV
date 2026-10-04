#------------------------------------------------------------------------------#
#  Galv's Variable Timer Functions
#------------------------------------------------------------------------------#
#  For: RPGMAKER VX ACE
#  Version 1.2
#------------------------------------------------------------------------------#
#  2012-10-24 - Version 1.2 - updated alias names for compatibility
#  2012-09-28 - Version 1.1 - Timer sprites now dispose when invisible.
#                             (thanks to Falcao's advice to do so)
#  2012-09-28 - Version 1.0 - release
#------------------------------------------------------------------------------#
#
#  This script allows a bit more control over the timer and how it looks
#  - Use a custom graphic for the timer
#  - Change font, text size and colour of numbers
#  - Variable speed that can count up or down
#  - Additional script calls for functionality (see below)
#
#
#  The below can be used in event script calls.
#------------------------------------------------------------------------------#
#  To freeze the timer:
#  $game_timer.freeze
#------------------------------------------------------------------------------#
#  To unfreeze the timer:
#  $game_timer.unfreeze
#------------------------------------------------------------------------------#
#  To increase time (x is number of seconds):
#  $game_timer.increase(x)
#------------------------------------------------------------------------------#
#  To decrease time (x is number of seconds):
#  $game_timer.decrease(x)
#------------------------------------------------------------------------------#
#  To set timer to equal a variable (y is variable ID to use):
#  $game_timer.set(y)
#------------------------------------------------------------------------------#
#  To increase timer by a variable (y is variable ID to use):
#  $game_timer.increase_var(y)
#------------------------------------------------------------------------------#
#  To decrease timer by a variable (y is variable ID to use):
#  $game_timer.decrease_var(y)
#------------------------------------------------------------------------------#
#
#  Event commands for the timer still work.
#  eg. (start, stop, conditional branch, set variable to timer)
#
#------------------------------------------------------------------------------#

#------------------------------------------------------------------------------#  
#  !!!!! WARNING - I am a learning scripter. Use this at your own risk!!!!!!
#------------------------------------------------------------------------------#

$imported = {} if $imported.nil?
$imported["Variable_Timer"] = true

module Variable_Timer

#------------------------------------------------------------------------------#
#  SCRIPT SETUP OPTIONS
#------------------------------------------------------------------------------#

  TIME_SPEED_VAR = 4    # The ID of the variable that sets the timer speed.
                        # Change this variable in-game to the speed per second.
                        # Negatives count down, positives count up. 0 pauses.

  HIDE_TIMER_SWITCH = 93       # Switch ID to turn on/off the timer visibility.

  ABORT_BATTLE = false        # When timer reached 0 in battle it would abort 
                              # the combat. Choose if that's true or false.
  

  TIMER_GRAPHIC = "Timer"     # Graphic in /Graphics/System folder to use.
                              # put "" If you don't want a graphic.

  TIMER_FONT = "DS-Digital"        # Font of timer numbers. Make it "" for default.

  TEXT_SIZE = 28              # Size of timer numbers.

  R = 255                     # Colour of numbers using RGB values
  G = 255                     # (red, green, blue)
  B = 255

#------------------------------------------------------------------------------#
#  END SCRIPT SETUP OPTIONS
#------------------------------------------------------------------------------#

end

class Game_Timer

  #--------------------------------------------------------------------------
  # * OVERWRITE Update
  #--------------------------------------------------------------------------
  def update
    return if @freeze_time
    if @working && @count > 0
        @count += $game_variables[Variable_Timer::TIME_SPEED_VAR]
      on_expire if @count == 0 && Variable_Timer::ABORT_BATTLE
    end
    if @working && @count < 0
      @count = 0
    end
  end
  
  def freeze
    @freeze_time = true
  end

  def unfreeze
    @freeze_time = false
  end
  
  def increase(time)
    @count += time * Graphics.frame_rate
  end

  def decrease(time)
    @count -= time * Graphics.frame_rate
  end
  
  def set(var)
    @count = $game_variables[var] * Graphics.frame_rate
  end
  
  def increase_var(var)
    @count += $game_variables[var] * Graphics.frame_rate
  end
  
  def decrease_var(var)
    @count -= $game_variables[var] * Graphics.frame_rate
  end

end # Game_Timer


class Sprite_Timer < Sprite

  alias galv_vartimer_dispose dispose
  def dispose
    @timer_sprite.dispose if !@timer_sprite.nil?
    galv_vartimer_dispose
  end

  def create_timer_sprite
    @timer_sprite = Sprite.new
    @timer_sprite.bitmap = Cache.system(Variable_Timer::TIMER_GRAPHIC)
    @timer_sprite.opacity = 255
    @timer_sprite.x = Graphics.width - @timer_sprite.bitmap.width
  end
  
  alias galv_vartimer_create_bitmap create_bitmap
  def create_bitmap
    galv_vartimer_create_bitmap
    self.bitmap.font.name = Variable_Timer::TIMER_FONT unless Variable_Timer::TIMER_FONT == ""
    self.bitmap.font.size = Variable_Timer::TEXT_SIZE
    self.bitmap.font.color.set(Variable_Timer::R, Variable_Timer::G, Variable_Timer::B)
  end

  alias galv_vartimer_update_visibility update_visibility
  def update_visibility
    galv_vartimer_update_visibility
    if $game_timer.working? && !$game_switches[Variable_Timer::HIDE_TIMER_SWITCH]
      create_timer_sprite if @timer_sprite.nil? || @timer_sprite.disposed?
    else
      @timer_sprite.dispose if !@timer_sprite.nil?
      self.visible = false
    end
  end
  
end # Sprite_Timer < Sprite