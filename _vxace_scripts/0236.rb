=begin
#===============================================================================
 Title: Character Sprite Zooming
 Author: Hime
 Date: Feb 3, 2015
 URL: http://himeworks.com/2014/12/character-sprite-zooming/
--------------------------------------------------------------------------------
 ** Change log
 Feb 3, 2015
   - modified script to support zoom animations
 Dec 6, 2014
   - Initial release
--------------------------------------------------------------------------------   
 ** Terms of Use
 * Free to use in non-commercial projects
 * Contact me for commercial use
 * No real support. The script is provided as-is
 * Will do bug fixes, but no compatibility patches
 * Features may be requested but no guarantees, especially if it is non-trivial
 * Credits to Hime Works in your project
 * Preserve this header
--------------------------------------------------------------------------------
 ** Description
 
 This script allows you to control the zoom-level for character sprites, which
 includes the player, followers, events, and the default vehicles.
 
 Due to the visual nature of this script, while followers are also supported,
 they won't display correctly. This means that your followers will appear to be
 glued to each other and the player because that is how movement works.
 
 Note that the engine supports many different ways of drawing character
 sprites. This script only supports character *sprites*, rather than character
 images.
 
--------------------------------------------------------------------------------
 ** Installation
 
 In the script editor, place this script below Materials and above Main

--------------------------------------------------------------------------------
 ** Usage
 
 -- Events --
 
 To change event sprite zooming on the map, use one of the script calls

   zoom_event_sprite(ID, zoom)
   zoom_event_sprite(ID, zoom, duration)
   zoom_event_sprite(ID, zoom, duration, wait)
   zoom_event_sprite(ID, zoom, duration, wait, zoom_y)
   zoom_event_sprite(ID, zoom, duration, wait, zoom_y, duration_y)
   
 Where the ID is the ID of the event, and the zoom is a percentage. 1 is 100%,
 0.5 is 50% (half size), and 2 is 200% (double size)
 
 The duration allows you to create a zoom animation over-time. It is
 specified in frames and can be any integer that is 0 or higher.
 
 If `wait` is true, then the event will stop processing commands until the zoom
 animation is complete. If it is false, it will continue to run even though
 the animation is still going.
 
 When only one `zoom` value is specified, it assumes both the width and height
 will be zoomed proportionally.
   
 You can specify separate zoom behavior for each direction by passing in
 additional arguments.
 
 -- Players and Followers --
 
 To change player sprite zooming, use one of the script calls
   
   zoom_player_sprite(zoom)
   zoom_player_sprite(zoom, duration)
   zoom_player_sprite(zoom, duration, wait)
   zoom_player_sprite(zoom, duration, wait, zoom_y)
   zoom_player_sprite(zoom, duration, wait, zoom_y, duration_y)
 
 -- Vehicles --
 
 To change player sprite zooming, use one of the script calls
   
   zoom_vehicle_sprite(type, zoom)
   zoom_vehicle_sprite(type, zoom, duration)
   zoom_vehicle_sprite(type, zoom, duration, wait)
   zoom_vehicle_sprite(type, zoom, duration, wait, zoom_y)
   zoom_vehicle_sprite(type, zoom, duration, wait, zoom_y, duration_y)
   
 These are the vehicles that are available
 
   :ship
   :boat
   :airship
--------------------------------------------------------------------------------
 ** Examples
 
 Zoom event 3 to double the size
 
   zoom_event_sprite(3, 2)
   
 Zoom player and followers to half-size, over 60 frames
 
   zoom_player_sprite(0.5, 60, true)
   
 Stretch ship's width by 2 and shrink height to half.
 Width will change in 30 frames, height will change in 60 frames. The
 event will not wait for the animation.
 
   zoom_vehicle_sprite(:ship, 2, 30, false, 0.5, 60)
 
#===============================================================================
=end
$imported = {} if $imported.nil?
$imported[:TH_CharacterSpriteZoom] = true
#===============================================================================
# ** Rest of script
#===============================================================================
class Sprite_Character < Sprite_Base
  alias :th_character_sprite_zoom_update_other :update_other
  def update_other
    th_character_sprite_zoom_update_other  
    self.zoom_x = @character.zoom_x
    self.zoom_y = @character.zoom_y
  end  
end

class Game_Character
  attr_reader :zoom_x
  attr_reader :zoom_y
  attr_reader :target_zoom_duration
  attr_reader :target_zoom_duration_y
  
  alias :th_character_sprite_zoom_init_public_members :init_public_members
  def init_public_members
    th_character_sprite_zoom_init_public_members
    @zoom_x = 1.0
    @zoom_y = 1.0
    @target_zoom_duration = 0
    @target_zoom_duration_y = 0  
    @is_zooming = false
  end
  
  def setup_zoom(zoom, zoom_duration, zoom_y=nil, zoom_duration_y=nil)    
    @target_zoom = zoom
    @target_zoom_y = zoom_y || zoom
    p @target_zoom_y
    @target_zoom_duration = zoom_duration
    @target_zoom_duration_y = zoom_duration_y || zoom_duration
    @is_zooming = true
  end
  
  alias :th_character_sprite_zooming_update :update
  def update
    th_character_sprite_zooming_update
    update_zoom
  end
  
  def update_zoom
    return unless @is_zooming
    dx = @target_zoom_duration
    
    if @zoom_x == @target_zoom
      @target_zoom_duration = 0
    elsif dx == 0
      @zoom_x = @target_zoom
    elsif dx > 0      
      @zoom_x = (@zoom_x * (dx - 1) + @target_zoom) / dx
      @target_zoom_duration -= 1
    end
    
    dy = @target_zoom_duration_y
    if @zoom_y == @target_zoom_y
      @target_zoom_duration_y = 0
    elsif dy == 0
      @zoom_y = @target_zoom_y
    elsif dy > 0
      @zoom_y = (@zoom_y * (dy - 1) + @target_zoom_y) / dy
      @target_zoom_duration_y -= 1
    end
        
    @iz_zooming = false if dx == 0 && dy == 0
  end
end

class Game_Interpreter
  
  def zoom_character_sprite(chara, zoom_x, duration, wait, zoom_y, duration_y)
    chara.setup_zoom(zoom_x, duration, zoom_y, duration_y)
    Fiber.yield while chara.target_zoom_duration > 0 || chara.target_zoom_duration_y > 0 if wait
  end  
  
  def zoom_event_sprite(event_id, zoom_x=1.0, duration=0, wait=true, zoom_y=nil, duration_y=nil)
    event = get_character(event_id)
    zoom_character_sprite(event, zoom_x, duration, wait, zoom_y, duration_y)    
  end

  def zoom_player_sprite(zoom_x=1.0, duration=0, wait=true, zoom_y=nil, duration_y=nil)
    zoom_character_sprite($game_player, zoom_x, duration, wait, zoom_y, duration_y)
    $game_player.followers.each do |follower|
      zoom_character_sprite(follower, zoom_x, duration, wait, zoom_y, duration_y)
    end
  end
  
  def zoom_vehicle_sprite(type, zoom_x=1.0, duration=60, wait=true, zoom_y=nil, duration_y=nil)
    case type
    when :ship
      vehicle = $game_map.ship
    when :boat
      vehicle = $game_map.boat
    when :airship
      vehicle = $game_map.airship
    end
    zoom_character_sprite(vehicle, zoom_x, duration, wait, zoom_y, duration_y)
  end
end