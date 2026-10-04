#------------------------------------------------------------------------------#
#  Galv's Party Selector
#------------------------------------------------------------------------------#
#  For: RPGMAKER VX ACE
#  Version 1.8
#------------------------------------------------------------------------------#
#  2013-06-12 - Version 1.8 - minor change for compatibility reasons
#  2013-02-27 - Version 1.7 - fixed a bug with lots of party members
#  2013-01-09 - Version 1.6 - added party call without the leader
#  2013-01-09 - Version 1.5 - setting added for number of faces visible
#  2013-01-07 - Version 1.4 - fixed more than 5 actors and bugs
#  2013-01-07 - Version 1.2 - added ability to set list of actors to choose
#  2013-01-06 - Version 1.1 - bug fixes
#  2013-01-06 - Version 1.0 - release
#------------------------------------------------------------------------------#
# A simple window that allows you to select one of your party members and like
# the 'select key item' window, it stores the actor ID of the party member
# chosen into the variable you set in the settings. You then use this in a
# conditional branch.
#
# NOTE: This script is not a full-blown party recruit system and I won't be
# updating it to be as such. It's meant to be a simple event utility script.
#
#------------------------------------------------------------------------------#
#  INSTRUCTIONS:
#------------------------------------------------------------------------------#
#  Put script under Materials and above Main
#  Images go in /Graphics/Pictures folder.
#
#------------------------------------------------------------------------------#
#  SCRIPT CALLS:
#------------------------------------------------------------------------------#
#
#  party_select(0)     # Calls party select window with current party members
#
#  party_select(-1)    # Calls party select window without the leader
#
#  party_select(1,2,3,4,5) # Calls party select window with list of actors with
#                          # ID's included in this list.
#------------------------------------------------------------------------------#
 
($imported ||= {})["Galvs_PartySelector"] = true
module Galv_PartyPick
 
#------------------------------------------------------------------------------#
#  SCRIPT SETTINGS
#------------------------------------------------------------------------------#
 
  VARIABLE_ID = 19           # Variable ID the actor ID is stored in.
   
  FACES_VISIBLE = 5         # Number of faces visible on screen.
 
#------------------------------------------------------------------------------#
#  END SCRIPT SETTINGS
#------------------------------------------------------------------------------#
 
end
 
 
class Window_Message < Window_Base
   
  alias galv_partypick_create_all_windows create_all_windows
  def create_all_windows
    galv_partypick_create_all_windows
    @partypick_window = Window_Party_Selector.new
  end
   
  alias galv_partypick_dispose_all_windows dispose_all_windows
  def dispose_all_windows
    galv_partypick_dispose_all_windows
    @partypick_window.dispose
  end
   
  alias galv_partypick_update_all_windows update_all_windows
  def update_all_windows
    galv_partypick_update_all_windows
    @partypick_window.update
  end
   
  alias galv_partypick_process_input process_input
  def process_input
    if $game_message.party_select == true
      return party_select
    end
    galv_partypick_process_input
  end
 
  def party_select
    @partypick_window.start
    Fiber.yield while @partypick_window.active
  end
   
end # Window_Message < Window_Base
 
 
class Window_Party_Selector < Window_Selectable
 
  def initialize
      super(window_x, 0, window_width, 96 + standard_padding * 2)
      self.openness = 0
      @set = true
      get_item_max
      refresh
      deactivate
      set_handler(:ok,     method(:on_ok))
      set_handler(:cancel, method(:on_cancel))
    end
     
  def window_x
    (Graphics.width - window_width) / 2
  end
   
  def window_width
    return (96 * col_max) + (standard_padding * 2)
  end
 
  def visible_line_number
    return 1
  end
 
  def col_max
    return Galv_PartyPick::FACES_VISIBLE
  end
   
  def spacing
    return 0
  end
   
  def get_item_max
    if $game_message.party_list == [0] || $game_message.party_list[0] < 0
      @item_max = $game_party.members.count
      @item_max -= 1 if $game_message.party_list[0] < 0
    else
      @item_max = $game_message.party_list.count
    end
  end
   
  def contents_width
    0  #item_width * (item_max + 23) - spacing
  end
   
  def contents_height
    item_height
  end
   
  def start
    get_item_max
    update_y
    refresh
    select(0)
    open
    activate
  end
   
  def update_y
    if $game_message.position == 2
      self.y = 0
    else
      self.y = Graphics.height - height
    end
  end
   
  def refresh
      self.contents.clear
      self.contents = Bitmap.new(@item_max * 96, 96)
      for i in 0...@item_max
         draw_item(i) unless i == nil
      end
  end
   
  def check_item_max
    @data_max = 0
    @data_max -= 1 if $game_message.party_list[0] < 0
    if $game_message.party_list == [0] || $game_message.party_list[0] < 0
       
      @data_max = $game_party.members.count
    else
       
        @data_max = $game_message.party_list.count
       
    end
  end
   
  def item_height
    96
  end
 
  def item_width
    96
  end
   
  def draw_item(index)
    x = index * (item_width + spacing)
    y = 0
    check_item_max
    if $game_message.party_list == [0]
      @mem = $game_party.members
      draw_face(@mem[index].face_name, @mem[index].face_index, x, y, @set)
    elsif $game_message.party_list[0] < 0
      @mem = $game_party.members
      draw_face(@mem[index+1].face_name, @mem[index+1].face_index, x, y, @set)
    else
      @mem = $game_actors
      @plist = $game_message.party_list
      draw_face(@mem[@plist[index]].face_name, @mem[@plist[index]].face_index, x, y, @set)
    end
  end
 
  def item_max
    return @item_max == nil ? 0 : @item_max 
  end      
   
  def on_ok
    if $game_message.party_list == [0]
      $game_variables[Galv_PartyPick::VARIABLE_ID] = @mem[index].id
    elsif $game_message.party_list[0] < 0
      $game_variables[Galv_PartyPick::VARIABLE_ID] = @mem[index+1].id
    else
      $game_variables[Galv_PartyPick::VARIABLE_ID] = @plist[index]
    end
    $game_message.party_select = false
    close
  end
 
  def on_cancel
    $game_variables[Galv_PartyPick::VARIABLE_ID] = 0
    $game_message.party_select = false
    close
  end
   
  def top_col
    ox / (item_width + spacing)
  end
 
  def top_col=(col)
    col = 0 if col < 0
    col = item_max if col > item_max
    self.ox = col * (item_width + spacing)
  end
 
  def bottom_col
    top_col + col_max - 1
  end
 
  def bottom_col=(col)
    self.top_col = col - (col_max - 1)
  end
 
  def ensure_cursor_visible
    self.top_col = index if index < top_col
    self.bottom_col = index if index > bottom_col
  end
 
  def item_rect(index)
    rect = super
    rect.x = index * (item_width + spacing)
    rect.y = 0
    rect
  end
   
end #Window_Party_Selector < Window_Selectable
 
 
class Game_Message
  attr_accessor :party_select
  attr_accessor :party_list
   
  alias galv_partypick_clear clear
  def clear
    galv_partypick_clear
    @party_select = false
    @party_list = [0]
  end
end # Game_Message
 
class Game_Interpreter
  def party_select(*args)
    wait_for_message
 
    $game_message.party_list = [*args]
    $game_message.party_select = true
 
    if @list[@index + 2].code == 401
       
      if @list[@index + 1].code == 101
        $game_message.face_name = @list[@index + 1].parameters[0]
        $game_message.face_index = @list[@index + 1].parameters[1]
        $game_message.background = @list[@index + 1].parameters[2]
        $game_message.position = @list[@index + 1].parameters[3]
      end
       
      while @list[@index + 2].code == 401
      @index += 1
      $game_message.add(@list[@index + 1].parameters[0])
      end
       
    else
      $game_message.add("")
      $game_message.background = 2
      $game_message.position = 2
    end
    wait_for_message
 
  end
end # Game_Interpreter