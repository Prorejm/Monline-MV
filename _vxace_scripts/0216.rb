#------------------------------------------------------------------------------#
#  Galv's Cam Control
#------------------------------------------------------------------------------#
#  For: RPGMAKER VX ACE
#  Version 1.4
#------------------------------------------------------------------------------#
#  2013-03-18 - Version 1.4 - fixed a bug where it crashed if you didn't turn
#                           - off following an event when transferring to a map
#                           - without that event.
#  2013-03-18 - Version 1.3 - fixed a bug with parallax motion stopping
#  2013-03-04 - Version 1.2 - re-written script to scroll to targets
#  2012-10-24 - Version 1.1 - updated alias naming for compatability
#  2012-10-20 - Version 1.0 - release
#------------------------------------------------------------------------------#
#  This script allows some control over where the camera is through use of
#  script calls. You can fix the camera to a location on the map or follow an
#  event's movements.
#------------------------------------------------------------------------------#
#  SCRIPT CALLS:
#------------------------------------------------------------------------------#
#
#  cam_follow(event_id,speed)   # Camera follows event instead of player
#  cam_center(speed)            # Moves camera back to player
#  cam_set(x,y,speed)      # Position the camera centered on x, y coordinates
#
# # NOTE: speed can be 1 to 6 or you can leave it out of the script call to
#         default to 6. If you want to instantly snap the camera without it
#         scrolling, make speed 0
#
#------------------------------------------------------------------------------#
#  EXAMPLES:
#  cam_set(10,5)         # Moves camera to map co-ordinates x 10, y5 at speed 6
#  cam_set(10,5,2)       # Moves camera to map co-ordinates x 10, y5 at speed 2
#  cam_follow(4)         # Moves camera to event 4's location and follows it.
#  cam_follow(4,0)       # SNAPS camera to event 4's location and follows it.
#  cam_center            # Moves camera to player at speed 6
#  cam_center(0)         # Snaps camera to player instantly
#------------------------------------------------------------------------------#
# NO OPTIONS FOR YOU TO EDIT. SORRY.
#------------------------------------------------------------------------------#
 
$imported = {} if $imported.nil?
$imported["Camera_Control"] = true
 
class Game_Map
  attr_accessor :cam_target
   
  alias galv_cam_control_gm_setup setup
  def setup(map_id)
    @cam_target = 0
    galv_cam_control_gm_setup(map_id)
    @scroll_blocked = false
  end
   
  def scroll_to_target(x,y,speed)
    if @display_y.to_i < y && @display_x.to_i > x && can_move?(2) && can_move?(4)
      dir = 1
    elsif @display_y.to_i > y && @display_x.to_i > x && can_move?(8) && can_move?(4)
      dir = 7
    elsif @display_y.to_i > y && @display_x.to_i < x && can_move?(8) && can_move?(6)
      dir = 9
    elsif @display_y.to_i < y && @display_x.to_i < x && can_move?(2) && can_move?(6)
      dir = 3
    elsif @display_y.to_i < y && can_move?(2)
      dir = 2
    elsif @display_y.to_i > y && can_move?(8)
      dir = 8
    elsif @display_x.to_i < x && can_move?(6)
      dir = 6
    elsif @display_x.to_i > x && can_move?(4)
      dir = 4
    else
      dir = 0
    end
    if dir > 0
      start_scroll(dir, 1, speed)
      @scroll_blocked = false
    else
      @scroll_blocked = true
    end
    Fiber.yield while scrolling?
  end
   
  def cannot_scroll?
    @scroll_blocked == true
  end
   
  def can_move?(dir)
    case dir
    when 2; (@display_y % @map.height) < height - (Graphics.height / 32)
    when 4; (@display_x % @map.width) > 0
    when 6; (@display_x % @map.width) < width - (Graphics.width / 32)
    when 8; (@display_y % @map.height) > 0
    end
  end
   
  #overwrite
  def do_scroll(dir, dis)
    case dir
    when 1
      scroll_down(dis); scroll_left(dis)
    when 2
      scroll_down(dis)
    when 3
      scroll_down(dis); scroll_right(dis)
    when 4
      scroll_left(dis)
    when 6
      scroll_right(dis)
    when 7
      scroll_up(dis); scroll_left(dis)
    when 8
      scroll_up(dis)
    when 9
      scroll_up(dis); scroll_right(dis)
    end
  end
   
  def set_event_display_pos(x, y)
    x = [0, [x, width - screen_tile_x].min].max unless loop_horizontal?
    y = [0, [y, height - screen_tile_y].min].max unless loop_vertical?
    @display_x = (x + width) % width
    @display_y = (y + height) % height
  end
   
end # Game_Map
 
class Game_Player < Game_Character
  alias galv_cam_control_gp_update update
  def update
    if $game_map.cam_target > 0
      last_real_x = $game_map.events[$game_map.cam_target].real_x
      last_real_y = $game_map.events[$game_map.cam_target].real_y
      $game_map.set_event_display_pos(last_real_x - center_x, last_real_y - center_y)
    end
    galv_cam_control_gp_update
  end
   
  alias galv_cam_control_gp_update_scroll update_scroll
  def update_scroll(last_real_x, last_real_y)
    return if $game_map.cam_target != 0
    galv_cam_control_gp_update_scroll(last_real_x, last_real_y)
  end
end # Game_Player < Game_Character
 
class Game_Interpreter
   def cam_center(speed = 6)
    $game_map.cam_target = -1
    scroll_to_event(0,speed) if speed != 0
    $game_map.set_display_pos($game_player.x - $game_player.center_x, $game_player.y - $game_player.center_y)
    $game_map.cam_target = 0
  end
   
  def cam_set(x,y,speed = 6)
    $game_map.cam_target = -1
    scroll_to_target(x,y,speed) if speed != 0
    $game_map.set_display_pos(x - $game_player.center_x, y - $game_player.center_y)
  end
   
  def scroll_to_target(x,y,speed)
    scroll_x = (x - $game_player.center_x).to_i
    scroll_y = (y - $game_player.center_y).to_i
    loop do
      $game_map.scroll_to_target(scroll_x,scroll_y,speed)
      if $game_map.display_x == scroll_x && $game_map.display_y == scroll_y ||
        $game_map.cannot_scroll?
        break 
      end
    end
  end
   
  def scroll_to_event(id,speed)
    if id > 0; char = $game_map.events[id]
    else; char = $game_player; end
    loop do
      scroll_x = char.x - $game_player.center_x
      scroll_y = char.y - $game_player.center_y
      $game_map.scroll_to_target(scroll_x,scroll_y,speed)
      if $game_map.display_x == scroll_x && $game_map.display_y == scroll_y ||
        $game_map.cannot_scroll?
        break 
      end
    end
  end
   
  def cam_follow(event_id,speed = 6)
    $game_map.cam_target = -1
    scroll_to_event(event_id,speed) if speed != 0
    $game_map.cam_target = event_id
  end
end # Game_Interpreter