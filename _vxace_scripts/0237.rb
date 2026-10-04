#--------------------------------------------------
# Remember Event Position 1.0
#--------------------------------------------------
#
# Author: Shaz
#
# Description: This script lets you set the position and direction
#              where an event will appear next time the map is
#              loaded.  Events will appear in this new position
#              rather than the place they were put during design.
#
#--------------------------------------------------
#
# Installation: 
#
# Copy into a new script slot in the Materials section
#
#--------------------------------------------------
#
# Use:
#
# Examples below show syntax for an Event Command on an Event Tab.
#   You can use @event_id for the current event, or specify an event number.
# To execute from within a Set Move Route command, omit the
#   $game_map.events[@event_id]. part, and just use save_pos() and forget_pos().
#
# To tell an event to move to its current position the next time
# the map is loaded, execute the following in a script call:
#   $game_map.events[@event_id].save_pos()
#
# To tell an event to move to a particular position (not its
# current position) the next time the map is loaded,
# execute the following in a script call:
#   $game_map.events[@event_id].save_pos(1, 2, 8)
# - the above will move the event to x=1, y=2, facing up
#
# To tell an event to forget its previously remembered position
# and go back to its default position the next time time map
# is loaded, execute the following in a script call:
#   $game_map.events[@event_id].forget_pos()
#--------------------------------------------------

class Game_System
  alias shaz_mem_position_gs_init initialize

  attr_accessor :event_positions

  def initialize
    shaz_mem_position_gs_init
    @event_positions = {}
  end
end

# Check to ensure $game_system.event_positions exists (save files created
# prior to this script being added would not have it initialized)
class Game_Map
  alias shaz_mem_positions_gm_init initialize

  def initialize
    shaz_mem_positions_gm_init
    $game_system.event_positions = {} if !$game_system.event_positions
  end
end

class Game_CharacterBase
  attr_accessor
end

class Game_Event
  alias shaz_mem_position_gcb_init initialize

  def initialize(map_id, event)
    shaz_mem_position_gcb_init(map_id, event)

    if $game_system.event_positions.has_key?([map_id, @id])
      mvx, mvy, mvdir = $game_system.event_positions[[map_id, @id]]
      moveto(mvx, mvy)
      set_direction(mvdir) if mvdir
      @stop_count = 0
      refresh
    end
  end

  def save_pos(x = @x, y = @y, dir = @direction)
    $game_system.event_positions[[@map_id, @id]] = [x, y, dir]
  end

  def forget_pos
    $game_system.event_positions.delete([@map_id, @id])
  end
end