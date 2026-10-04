=begin
#===============================================================================
 Title: Picture Anchors
 Author: Hime
 Date: Nov 23, 2014
--------------------------------------------------------------------------------
 ** Change log
 Nov 23, 2014
   - Initial release
--------------------------------------------------------------------------------   
 ** Terms of Use
 * Free to use in non-commercial projects
 * Contact me for commercial use
 * No real support. The script is provided as-is
 * Will do bug fixes, but no compatibility patches
 * Features may be requested but no guarantees, especially if it is non-trivial
 * Credits to HimeWorks in your project
 * Preserve this header
--------------------------------------------------------------------------------
 ** Description
 
 This script introduces the concept of "picture anchors". An anchor is a tool
 that fixes an object to a certain position. A picture anchor functions the
 same way: it fixes the picture to a certain position.
 
 By default, pictures are anchored to the screen. This is why no matter where
 you move, the picture always follows you.
 
 This script allows you to change the picture's anchor. You can anchor a picture
 to a character on the map so that the picture follows that character instead
 of the screen.
 
 You can also anchor the picture to a position on the map, so that the picture
 will never move from that position as long as it is anchored there. By
 anchoring a picture to the map, you can use these pictures for additional
 visual effects that you normally could not obtain using the tile editor.
 
--------------------------------------------------------------------------------
 ** Installation
 
 In the script editor, place this below Materials and above Main. 

--------------------------------------------------------------------------------
 ** Usage 
 
 Every picture has an ID. When you use the "Show Picture" command, you
 specify the ID of the picture that you want to use. You would then use this
 ID whenever you want to refer to that picture.
 
 Picture anchors work the same way: you must specify which picture the anchor
 will be applied to.
 
 Script calls are used to set anchors. There are different types of anchors.
 
   -- Screen Anchor --
   
 This is the default anchor. Pictures that are anchored to the screen will
 follow the screen. To anchor a picture to the screen, use the script call
 
   anchor_picture_to_screen(id)
   
 Where the ID is the ID of the picture.
   
   -- Map Anchor --
 
 If you would like to anchor a picture to a specific position on the map,
 use a map anchor. Use the script call
 
   anchor_picture_to_map(id, x, y)
 
 Note that the position is specified in tile coordinates, not pixel coordinates.
 
   -- Character Anchor --
   
 If you would like to anchor a picture to a character on the map, use this
 anchor. A character can be the player, an event, a follower, or a vehicle.
 Use the appropriate script call
 
   anchor_picture_to_player(id)
   anchor_picture_to_event(id, event_id)
   anchor_picture_to_follower(id, follower_num)
   anchor_picture_to_vehicle(id, vehicle_type)
   
 For followers, the first follower is the actor right behind the leader.
 For vehicles, these are the vehicles types:
 
   :ship
   :boat
   :airship
  
#===============================================================================
=end
$imported = {} if $imported.nil?
$imported[:TH_PictureAnchors] = true
#===============================================================================
# ** Configuration
#===============================================================================
module TH
  module Picture_Anchor
  end
end
#===============================================================================
# ** Rest of Script
#===============================================================================
class Data_PictureAnchor
  
  attr_reader :type
  attr_reader :object
  
  def initialize(type, object)
    @type = type
    @object = object
  end
end

class Game_Picture
  attr_accessor :anchor
  
  alias :th_picture_anchors_initialize :initialize
  def initialize(number)
    th_picture_anchors_initialize(number)
    @anchor = Data_PictureAnchor.new(:screen, nil)
  end
end

class Sprite_Picture < Sprite
  
  alias :th_picture_anchors_update_position :update_position
  def update_position
    if @picture.anchor.type == :character
      self.x = @picture.anchor.object.screen_x + @picture.x
      self.y = @picture.anchor.object.screen_y + @picture.y
      self.z = @picture.number
    elsif @picture.anchor.type == :map_position
      self.x = (@picture.anchor.object[0] - $game_map.display_x) * 32
      self.y = (@picture.anchor.object[1] - $game_map.display_y) * 32
      self.z = @picture.number
    else
      th_picture_anchors_update_position
    end
  end
end

class Game_Interpreter
  
  def anchor_picture_to_screen(number)
    anchor = Data_PictureAnchor.new(:screen, nil)
    screen.pictures[number].anchor = anchor
  end
  
  def anchor_picture_to_map(number, x, y)
    anchor = Data_PictureAnchor.new(:map_position, [x, y])
    screen.pictures[number].anchor = anchor
  end
  
  def anchor_picture_to_character(number, id)
    anchor = Data_PictureAnchor.new(:character, get_character(id))
    screen.pictures[number].anchor = anchor
  end
  
  #-----------------------------------------------------------------------------
  # Anchors the picture to a certain character on the map.
  #-----------------------------------------------------------------------------
  def anchor_picture_to_event(number, event_id)
    anchor_picture_to_character(number, event_id)
  end
  
  #-----------------------------------------------------------------------------
  # Anchors the picture to the player
  #-----------------------------------------------------------------------------
  def anchor_picture_to_player(number)
    anchor_picture_to_character(number, -1)
  end
  
  #-----------------------------------------------------------------------------
  # Anchors the picture to a party follower. The first follower is the second
  # party member
  #-----------------------------------------------------------------------------
  def anchor_picture_to_follower(number, follower_id)
    id = -(follower_id + 1)
    follower = $game_player.followers[id]
    anchor = Data_PictureAnchor.new(:character, follower)
    screen.pictures[number].anchor = anchor
  end
  
  def anchor_picture_to_vehicle(number, type)
    case type
    when :ship
      vehicle = $game_map.ship
    when :boat
      vehicle = $game_map.boat
    when :airship
      vehicle = $game_map.airship
    end
    if vehicle.map_id == $game_map.map_id
      anchor = Data_PictureAnchor.new(:character, vehicle)
      screen.pictures[number].anchor = anchor 
    end
  end
end

class Game_Vehicle
  attr_reader :map_id
end