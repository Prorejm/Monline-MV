#------------------------------------------------------------------------------#
#  Galv's Map Positions
#------------------------------------------------------------------------------#
#  For: RPGMAKER VX ACE
#  Version 1.8
#  Thanks Tsukihime for resizing assistance
#------------------------------------------------------------------------------#
#  2012-12-02 - Version 1.8 - items can activate more than one map now
#  2012-11-22 - Version 1.7 - disable switch added.
#                           - now auto-reizes images larger than screen to fit
#  2012-11-09 - Version 1.6 - added functionality for some escape codes in text
#  2012-11-09 - Version 1.5 - now hides player marker when inside vehicle
#                           - added event comments to put text at event markers
#                           - can display actor's name under player marker
#  2012-11-08 - Version 1.4 - noticed a crash and put a fix in place
#  2012-11-08 - Version 1.3 - bug fixes with event charset showing
#  2012-11-08 - Version 1.2 - can now choose charsets or custom pic for markers
#  2012-11-07 - Version 1.1 - added vehicle location display
#  2012-11-07 - Version 1.0 - release
#------------------------------------------------------------------------------#
#  This script brings up a picture (that you create) of a map and places a
#  marker to show the player and vehicle locations. You must make the map 
#  exactly to scale and it would be best if it fit on the screen.
#  (Default size is 544 x 416, as long as it fits in that, it should work.)
#  Save these maps in /Graphics/Pictures/ and name them like:
#  map2.jpg  - where the number is the map ID of the map. (Can be any supported
#  graphic file, not just jpg.)
#
#  EXAMPLE:
#  Pressing the MAP_BUTTON on a map with ID of 4 will look for "map4.xxx"
#
#  Maps can be set to require an item to view.
#------------------------------------------------------------------------------#
#  Notetag ITEMS with the below tag. x being the map ID of the map held.
#
#  <map: x>
#
#  Or for an item to allow showing multiple maps:
#
#  <map: x,y,z>
#
#------------------------------------------------------------------------------#
#  In addition to showing the player's location, you can add/remove blips that
#  show event locations to each map using SCRIPT CALLS:
#------------------------------------------------------------------------------#
#
#  show_map                      # Manually shows the map for the map the player
#                                # is on, even if the player doesn't have the 
#                                # required item in inventory.
#
#  add_blip(map_id,event_id)     # Makes event blip show on a map
#
#  rem_blip(map_id,event_id)     # Removes an event blip from a map
#
#------------------------------------------------------------------------------#
#  EXAMPLE:
#  add_blip(1,25)              # makes event 25 show as a blip on map with ID 1
#  rem_blip(1,25)              # removes that blip from the map.
#------------------------------------------------------------------------------#
#  An event can display text below it's marker. To do this, add an event comment
#  at the very top of the event page commands.
#  This comment MUST be at the very top of the event commands or else it
#  will not be displayed. You can use the following escape codes:
#------------------------------------------------------------------------------#
#  EVENT COMMENT TEXT CODES:
#
#  /v[x]      # display number in variable x
#  /n[x]      # display actor with ID x's name
#  /p[x]      # display party member in position x (0 is leader)
#  /g         # display currency type as set in vocab (eg. G)
#  /c[x]      # color of the text. Only one color will work per event text.   
#
#------------------------------------------------------------------------------#
#
#  See below for more settings
#
#------------------------------------------------------------------------------#
 
($imported ||= {})["Galvs_Map_Positions"] = true
 
module Galv_Map
 
#------------------------------------------------------------------------------#
#  SCRIPT SETUP OPTIONS
#------------------------------------------------------------------------------#
 
  DISABLE_MAP = 5          # Switch ID. When switch is ON, map cannot be called
 
  MAP_BUTTON = :L          # Button to open and close the map. (:X is key "a")
                           # to disable make this MAP_BUTTON = nil
 
  REQUIRE_ITEM = true      # Requires an item before the map can be revealed
                           # NOTE: If you turn this to false you MUST have an
                           # image for each map or it will crash!
 
  NO_MAP_MESSAGE = false    # display message if no map of area. true or false
  MESSAGE_TEXT = "You don't have a map of this area."  
  # displayed when trying to open the map scene without the required item.
 
 
 
  PLAYER_LOCATION_MARKER = 1     # 0 = custom picture (set below)
                                 # 1 = lead actor's charset graphic
  PLAYER_CUSTOM_PIC = "marker"   # image in /Graphics/Pictures/ if above is 0
  SHOW_ACTOR_NAME = false         # display lead actor's name under player marker
 
 
  VEHICLE_LOCATION_MARKER = 1  # 0 = use custom pictures (set below)
                               # 1 = use vehicles' charset images
  BOAT_IMAGE = "marker3"       # image in /Pictures/ for boat if above is 0
  SHIP_IMAGE = "marker3"       # image in /Pictures/ for ship marker if above is 0
  AIRSHIP_IMAGE = "marker3"    # image in /Pictures/ for airship marker if above is 0
 
 
  EVENT_LOCATION_MARKERS = 0  # 0 = use a custom picture for all (set below)
                              # 1 = use the event's charset image
  EVENT_IMAGE = "Marker2"     # image in /Pictures/ for events if above is 0
 
 
 
  EVENT_TEXT_SIZE = 20       # size of the text displayed under events
  EVENT_TEXT_COLOR = 0       # default color of this text
 
  PLAYER_TEXT_SIZE = 20      # size of the text displayed under player (if used)
  PLAYER_TEXT_COLOR = 6      # color of player name text
 
 
#------------------------------------------------------------------------------#
#  END SCRIPT SETUP OPTIONS
#------------------------------------------------------------------------------#
 
end
 
class RPG::Item
  def has_map
    if @has_map.nil?
      if @note =~ /<map:[ ](.*)>/i
        @has_map = $1.to_s.split(",").map {|i| i.to_i}
      else
        @has_map = []
      end
    end
    @has_map
  end
end # RPG::Item
 
 
class Scene_Map < Scene_Base
 
  alias galv_map_update_scene update_scene
  def update_scene
    galv_map_update_scene
    check_button unless scene_changing?
  end
 
  def check_button
    if Input.trigger?(Galv_Map::MAP_BUTTON) && !scene_changing?
      check_for_map unless $game_switches[Galv_Map::DISABLE_MAP] || $game_map.interpreter.running?
    end
  end
 
  def check_for_map
    item_count = $data_items.count
    item_count.times { |i|
      if !$data_items[i].nil?
        if $data_items[i].has_map.include?($game_map.map_id) && $game_party.item_number($data_items[i]) > 0
          return SceneManager.call(Scene_ViewMap)
        elsif !Galv_Map::REQUIRE_ITEM
          return SceneManager.call(Scene_ViewMap)
        end
      end
    }
    $game_message.add(Galv_Map::MESSAGE_TEXT) if Galv_Map::NO_MAP_MESSAGE
  end
 
end # Scene_Map < Scene_Base
 
 
class Scene_ViewMap < Scene_MenuBase
  def start
    super
    create_map_sprite
    create_player_blip
    create_event_blips
    create_boat_blip if $game_map.vehicles[0].map_id == $game_map.map_id
    create_ship_blip if $game_map.vehicles[1].map_id == $game_map.map_id
    create_airship_blip if $game_map.vehicles[2].map_id == $game_map.map_id
  end
 
  def update
    super
    flash_marker if $game_player.vehicle_type == :walk
    if Input.trigger?(Galv_Map::MAP_BUTTON) || Input.trigger?(:B)
      dispose_bitmaps
      SceneManager.return
    end
  end
 
  def dispose_bitmaps
    @map.bitmap.dispose
    @map.dispose
    if $game_player.vehicle_type == :walk
      @actor_marker.bitmap.dispose 
      @actor_marker.dispose
      if Galv_Map::SHOW_ACTOR_NAME
        @actor_text.bitmap.dispose
        @actor_text.dispose
      end
    end
    if !@event_blip.nil?
      t = @event_blip.count
      t.times { |i|
        if !@event_blip[i+1].nil?
          @event_blip[i+1].bitmap.dispose
          @event_blip[i+1].dispose
        end
        if !@event_text[i+1].nil?
          @event_text[i+1].bitmap.dispose
          @event_text[i+1].dispose
        end
      }
    end
    if $game_map.vehicles[0].map_id == $game_map.map_id
      @boat_marker.bitmap.dispose
      @boat_marker.dispose
    end
    if $game_map.vehicles[1].map_id == $game_map.map_id
      @ship_marker.bitmap.dispose
      @ship_marker.dispose
    end
    if $game_map.vehicles[2].map_id == $game_map.map_id
      @airship_marker.bitmap.dispose
      @airship_marker.dispose
    end
  end
 
  def create_map_sprite
    @map_temp = Sprite.new
    @map_temp.bitmap = Cache.picture("map" + $game_map.map_id.to_s)
 
    if @map_temp.bitmap.rect.width > Graphics.width || @map_temp.bitmap.rect.height > Graphics.height
 
      width_ratio = (@map_temp.bitmap.rect.width.to_f / Graphics.width.to_f).to_f
      height_ratio = (@map_temp.bitmap.rect.height.to_f / Graphics.height.to_f).to_f
 
      if width_ratio > height_ratio
        new_width = (@map_temp.bitmap.rect.width / width_ratio).to_f
        new_height = (@map_temp.bitmap.rect.height / width_ratio).to_f
      else
        new_width = (@map_temp.bitmap.rect.width / height_ratio).to_f
        new_height = (@map_temp.bitmap.rect.height / height_ratio).to_f
      end
 
      source = Rect.new(0, 0, new_width, new_height)
      @map = Sprite.new
      @map.bitmap = Bitmap.new(new_width,new_height)
      @map.bitmap.stretch_blt(source, @map_temp.bitmap, @map_temp.bitmap.rect)
       
      @map_temp.bitmap.dispose
      @map_temp.dispose
       
      @scale_x = ($game_map.width * 32).to_f / new_width.to_f
      @scale_y = ($game_map.height * 32).to_f / new_height.to_f
 
      @map.x = (Graphics.width.to_f - source.width.to_f).to_f / 2
      @map.y = (Graphics.height.to_f - source.height.to_f).to_f / 2
 
    else
       
      @map_temp.bitmap.dispose
      @map_temp.dispose
       
      @map = Sprite.new
      @map.bitmap = Cache.picture("map" + $game_map.map_id.to_s)
       
      @scale_x = ($game_map.width * 32).to_f / @map.bitmap.rect.width
      @scale_y = ($game_map.height * 32).to_f / @map.bitmap.rect.height
 
      @map.x = (Graphics.width - @map.bitmap.width).to_f / 2
      @map.y = (Graphics.height - @map.bitmap.height).to_f / 2
    end
 
  end
 
  def create_player_blip
    @pulse = 0
    return if $game_player.vehicle_type != :walk
    if Galv_Map::PLAYER_LOCATION_MARKER == 1
      @actor_marker = Sprite.new
      @actor_marker.bitmap = Cache.character($game_party.leader.character_name)
      sign = $game_party.leader.character_name[/^[\!\$]./]
      if sign && sign.include?('$')
        cw = @actor_marker.bitmap.width / 3
        ch = @actor_marker.bitmap.height / 4
      else
        cw = @actor_marker.bitmap.width / 12
        ch = @actor_marker.bitmap.height / 8
      end
      n = $game_party.leader.character_index
      @actor_marker.src_rect = Rect.new((n%4*3+1)*cw, (n/4*4)*ch, cw, ch)
 
      @actor_marker.x = (($game_player.x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (cw.to_f / 2).to_f + 4
      @actor_marker.y = (($game_player.y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (ch.to_f / 2).to_f + 4
      @actor_marker.z = @actor_marker.z + 2
      @actor_marker.bitmap.blt(0 - cw / 2, 0 - ch, @actor_marker.bitmap, @actor_marker.src_rect)
    else
      @actor_marker = Sprite.new
      @actor_marker.bitmap = Cache.picture(Galv_Map::PLAYER_CUSTOM_PIC)
      @actor_marker.x = (($game_player.x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (@actor_marker.bitmap.width / 2).to_f + 4
      @actor_marker.y = (($game_player.y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (@actor_marker.bitmap.height / 2).to_f + 4
      @actor_marker.z = @actor_marker.z + 2
    end
 
    return if !Galv_Map::SHOW_ACTOR_NAME
    @actor_text = Sprite.new
    @actor_text.bitmap = Bitmap.new(150, Galv_Map::PLAYER_TEXT_SIZE)
    @actor_text.bitmap.font.size = Galv_Map::PLAYER_TEXT_SIZE
    @actor_text.bitmap.font.color.set(text_color(Galv_Map::PLAYER_TEXT_COLOR))
    @actor_text.bitmap.draw_text(@actor_text.bitmap.rect, $game_party.leader.name, 1)
    @actor_text.x = (($game_player.x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (@actor_text.bitmap.width.to_f / 2).to_f + 5
    @actor_text.y = (($game_player.y / @scale_y.to_f).to_f * 32) + @map.y.to_f + (@actor_marker.src_rect.height.to_f / 2)
    @actor_text.z = @actor_marker.z
  end
 
 
  def flash_marker
    @pulse += 1
    @actor_marker.opacity -= 4 if @pulse > 0
    @actor_marker.opacity += 5 if @pulse < 0
    @pulse = -20 if @pulse >= 20
  end
 
  def tileset_bitmap(tile_id)
    Cache.tileset($game_map.tileset.tileset_names[5 + tile_id / 256])
  end
 
  def create_event_blips
    return if $game_map.markers[$game_map.map_id].nil?
    m = $game_map.markers[$game_map.map_id]
    event_count = m.count
    @event_blip = {}
    @event_text = {}
 
    if Galv_Map::EVENT_LOCATION_MARKERS == 1
 
      event_count.times { |i|
        if !$game_map.events[m[i]].nil?
          @tile_id = $game_map.events[m[i]].tile_id
          @event_text_color = Galv_Map::EVENT_TEXT_COLOR
          @event_blip[i+1] = Sprite.new
 
          if @tile_id > 0
            sx = (@tile_id / 128 % 2 * 8 + @tile_id % 8) * 32;
            sy = @tile_id % 256 / 8 % 16 * 32;
            @event_blip[i+1].bitmap = tileset_bitmap(@tile_id)
            @event_blip[i+1].src_rect.set(sx, sy, 32, 32)
            cw = @event_blip[i+1].src_rect.width
            ch = @event_blip[i+1].src_rect.height
          else
            @event_blip[i+1].bitmap = Cache.character($game_map.events[m[i]].character_name)
            sign = $game_map.events[m[i]].character_name[/^[\!\$]./]
            if sign && sign.include?('$')
              cw = @event_blip[i+1].bitmap.width / 3
              ch = @event_blip[i+1].bitmap.height / 4
            else
              cw = @event_blip[i+1].bitmap.width / 12
              ch = @event_blip[i+1].bitmap.height / 8
            end
            n = $game_map.events[m[i]].character_index
            case $game_map.events[m[i]].direction
            when 2; dir = 0; when 4; dir = ch; when 6; dir = ch * 2; when 8; dir = ch * 3; end
            pat = $game_map.events[m[i]].pattern; pat = 1 if pat > 2
            @event_blip[i+1].src_rect = Rect.new((n%4*3 + pat)*cw, (n/4*4)*ch + dir, cw, ch)
          end
          @event_blip[i+1].x = (($game_map.events[m[i]].x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (cw.to_f / 2).to_f + 4
          @event_blip[i+1].y = (($game_map.events[m[i]].y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (ch.to_f / 2).to_f + 4
          @event_blip[i+1].bitmap.blt(0 - cw / 2, 0 - ch, @event_blip[i+1].bitmap, @event_blip[i+1].src_rect)
 
          if $game_map.events[m[i]].list[0].code == 108
            @show_text = $game_map.events[m[i]].list[0].parameters[0]
            @show_text = convert_escape_characters(@show_text)
            @event_text[i+1] = Sprite.new
            @event_text[i+1].bitmap = Bitmap.new(150, Galv_Map::EVENT_TEXT_SIZE)
            @event_text[i+1].bitmap.font.size = Galv_Map::EVENT_TEXT_SIZE
            @event_text[i+1].bitmap.font.color.set(text_color(@event_text_color))
            @event_text[i+1].bitmap.draw_text(@event_text[i+1].bitmap.rect, @show_text, 1)
            @event_text[i+1].x = (($game_map.events[m[i]].x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (@event_text[i+1].bitmap.width.to_f / 2).to_f + 5
            @event_text[i+1].y = (($game_map.events[m[i]].y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (@event_text[i+1].bitmap.height.to_f / 2).to_f + (ch / 1.5).to_f
 
          end
        end        
      }
 
    else
 
      event_count.times { |i|
        @event_text_color = Galv_Map::EVENT_TEXT_COLOR
        if !$game_map.events[m[i]].nil?
          @event_blip[i+1] = Sprite.new
          @event_blip[i+1].bitmap = Cache.picture(Galv_Map::EVENT_IMAGE)
          @event_blip[i+1].x = (($game_map.events[m[i]].x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (@event_blip[i+1].bitmap.width / 2).to_f + 4
          @event_blip[i+1].y = (($game_map.events[m[i]].y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (@event_blip[i+1].bitmap.height / 2).to_f + 4
 
#          if $game_map.events[m[i]].list[0].code == 108
#            @show_text = $game_map.events[m[i]].list[0].parameters[0]
#            @show_text = convert_escape_characters(@show_text)
#            @event_text[i+1] = Sprite.new
#            @event_text[i+1].bitmap = Bitmap.new(150, Galv_Map::EVENT_TEXT_SIZE)
#            @event_text[i+1].bitmap.font.size = Galv_Map::EVENT_TEXT_SIZE
#            @event_text[i+1].bitmap.font.color.set(text_color(@event_text_color))
#            @event_text[i+1].bitmap.draw_text(@event_text[i+1].bitmap.rect, @show_text, 1)
#            @event_text[i+1].x = (($game_map.events[m[i]].x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (@event_text[i+1].bitmap.width.to_f / 2).to_f + 5
#            @event_text[i+1].y = (($game_map.events[m[i]].y / @scale_y.to_f).to_f * 32) + @map.y.to_f + (@event_blip[i+1].bitmap.height / 2)
#          end
        end
      }
    end
  end
 
  def create_boat_blip
 
    if Galv_Map::VEHICLE_LOCATION_MARKER == 1
      @boat_marker = Sprite.new
      @boat_marker.bitmap = Cache.character($game_map.vehicles[0].character_name)
      sign = $game_map.vehicles[0].character_name[/^[\!\$]./]
      if sign && sign.include?('$')
        cw = @boat_marker.bitmap.width / 3
        ch = @boat_marker.bitmap.height / 4
      else
        cw = @boat_marker.bitmap.width / 12
        ch = @boat_marker.bitmap.height / 8
      end
      n = $game_map.vehicles[0].character_index
 
      case $game_map.vehicles[0].direction
      when 2; dir = 0; when 4; dir = ch; when 6; dir = ch * 2; when 8; dir = ch * 3; end
 
      @boat_marker.src_rect = Rect.new((n%4*3+1)*cw, (n/4*4)*ch + dir, cw, ch)
      @boat_marker.x = (($game_map.vehicles[0].x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (cw.to_f / 2).to_f + 4
      @boat_marker.y = (($game_map.vehicles[0].y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (ch.to_f / 2).to_f + 4
      @boat_marker.z = @boat_marker.z + 1
    else
      @boat_marker = Sprite.new
      @boat_marker.bitmap = Cache.picture(Galv_Map::BOAT_IMAGE)
      @boat_marker.x = (($game_map.vehicles[0].x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (@boat_marker.bitmap.width / 2).to_f + 4
      @boat_marker.y = (($game_map.vehicles[0].y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (@boat_marker.bitmap.height / 2).to_f + 4
    end
  end
 
  def create_ship_blip
    if Galv_Map::VEHICLE_LOCATION_MARKER == 1
      @ship_marker = Sprite.new
      @ship_marker.bitmap = Cache.character($game_map.vehicles[1].character_name)
      sign = $game_map.vehicles[1].character_name[/^[\!\$]./]
      if sign && sign.include?('$')
        cw = @ship_marker.bitmap.width / 3
        ch = @ship_marker.bitmap.height / 4
      else
        cw = @ship_marker.bitmap.width / 12
        ch = @ship_marker.bitmap.height / 8
      end
      n = $game_map.vehicles[1].character_index
 
      case $game_map.vehicles[1].direction
      when 2; dir = 0; when 4; dir = ch; when 6; dir = ch * 2; when 8; dir = ch * 3; end
 
      @ship_marker.src_rect = Rect.new((n%4*3+1)*cw, (n/4*4)*ch + dir, cw, ch)
      @ship_marker.x = (($game_map.vehicles[1].x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (cw.to_f / 2).to_f + 4
      @ship_marker.y = (($game_map.vehicles[1].y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (ch.to_f / 2).to_f + 4
      @ship_marker.z = @ship_marker.z + 1
    else
      @ship_marker = Sprite.new
      @ship_marker.bitmap = Cache.picture(Galv_Map::SHIP_IMAGE)
      @ship_marker.x = (($game_map.vehicles[1].x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (@ship_marker.bitmap.width / 2).to_f + 4
      @ship_marker.y = (($game_map.vehicles[1].y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (@ship_marker.bitmap.height / 2).to_f + 4
    end
  end
  def create_airship_blip
    if Galv_Map::VEHICLE_LOCATION_MARKER == 1
      @airship_marker = Sprite.new
      @airship_marker.bitmap = Cache.character($game_map.vehicles[2].character_name)
      sign = $game_map.vehicles[2].character_name[/^[\!\$]./]
      if sign && sign.include?('$')
        cw = @airship_marker.bitmap.width / 3
        ch = @airship_marker.bitmap.height / 4
      else
        cw = @airship_marker.bitmap.width / 12
        ch = @airship_marker.bitmap.height / 8
      end
      n = $game_map.vehicles[2].character_index
 
      case $game_map.vehicles[2].direction
      when 2; dir = 0; when 4; dir = ch; when 6; dir = ch * 2; when 8; dir = ch * 3; end
 
      @airship_marker.src_rect = Rect.new((n%4*3+1)*cw, (n/4*4)*ch + dir, cw, ch)
      @airship_marker.x = (($game_map.vehicles[2].x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (cw.to_f / 2).to_f + 4
      @airship_marker.y = (($game_map.vehicles[2].y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (ch.to_f / 2).to_f + 4
      @airship_marker.z = @airship_marker.z + 1
    else
      @airship_marker = Sprite.new
      @airship_marker.bitmap = Cache.picture(Galv_Map::SHIP_IMAGE)
      @airship_marker.x = (($game_map.vehicles[2].x / @scale_x.to_f).to_f * 32) + @map.x.to_f - (@airship_marker.bitmap.width / 2).to_f + 4
      @airship_marker.y = (($game_map.vehicles[2].y / @scale_y.to_f).to_f * 32) + @map.y.to_f - (@airship_marker.bitmap.height / 2).to_f + 4
    end
  end
 
  def convert_escape_characters(text)
    result = text.to_s.clone
    result.gsub!(/\\/)            { "\e" }
    result.gsub!(/\e\e/)          { "\\" }
    result.gsub!(/\eV\[(\d+)\]/i) { $game_variables[$1.to_i] }
    result.gsub!(/\eN\[(\d+)\]/i) { $game_actors[$1.to_i].name}
    result.gsub!(/\eP\[(\d+)\]/i) {
      if $game_party.members[$1.to_i].nil?
        ""
      else
        $game_party.members[$1.to_i].name 
      end
    }
    result.gsub!(/\eG/i)          { Vocab::currency_unit }
    result.gsub((/\eC\[(\d+)\]/i)) { @event_text_color = $1.to_i }
    result.gsub!(/\eC\[(\d+)\]/i)  { "" }
    result
  end
  def text_color(n)
    Cache.system("Window").get_pixel(64 + (n % 8) * 8, 96 + (n / 8) * 8)
  end
 
end # Scene_ViewMap < Scene_MenuBase
 
class Game_Map
  attr_accessor :markers
 
  alias galv_map_initialize initialize
  def initialize
    galv_map_initialize
    @markers = {}
  end
 
end # Game_Map
 
 
class Game_Interpreter
 
  def add_blip(map_id,event_id)
    if $game_map.markers[map_id].nil?
      $game_map.markers[map_id] = [event_id]
    else
      return if $game_map.markers[map_id].include?(event_id)
      $game_map.markers[map_id] << event_id
    end
  end
 
  def rem_blip(map_id,event_id)
    if $game_map.markers[map_id].nil?
      return
    else
      return if !$game_map.markers[map_id].include?(event_id)
      $game_map.markers[map_id].delete(event_id)
    end
  end
 
  def show_map
    SceneManager.call(Scene_ViewMap)
  end
 
end # Game_Interpreter
 
 
class Game_Vehicle < Game_Character
  attr_reader :map_id
end
 
class Game_Player < Game_Character
  attr_reader :vehicle_type
end