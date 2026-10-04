#==============================================================================
# ** Scene_Loadout
#------------------------------------------------------------------------------
#  This class performs screen processing for gear loadouts.
#==============================================================================

class Scene_LoadLoadout < Scene_MenuBase
  
  #--------------------------------------------------------------------------
  # * Start Processing
  #--------------------------------------------------------------------------
  def start
    super
    create_command_window
  end
  #--------------------------------------------------------------------------
  # * Pre-Termination Processing
  #--------------------------------------------------------------------------
  def pre_terminate
    super
    close_command_window
  end
  #--------------------------------------------------------------------------
  # * Create Background
  #--------------------------------------------------------------------------
  def create_background
    super
    @background_sprite.tone.set(0, 0, 0, 128)
  end
  #--------------------------------------------------------------------------
  # * Create Command Window
  #--------------------------------------------------------------------------
  def create_command_window
    px = 202
    py = 168
    @command_window = Window_LLoadout.new(px,py)
    @command_window.set_handler(:LLoadout1, method(:command_LLode1))
    @command_window.set_handler(:LLoadout2, method(:command_LLode2))
    @command_window.set_handler(:LLoadout3, method(:command_LLode3))
    @command_window.set_handler(:cancel,   method(:return_scene))
  end
  #--------------------------------------------------------------------------
  # * Close Command Window
  #--------------------------------------------------------------------------
  def close_command_window
    @command_window.close
    update until @command_window.close?
  end

  #--------------------------------------------------------------------------
  # * [LLoadout 1] Command
  #--------------------------------------------------------------------------
  def command_LLode1
    Sound.play_equip
    a = $game_variables[204][0]
    $game_actors[$game_variables[207]].change_equip_by_id(0, a)
    b = $game_variables[204][1]
    $game_actors[$game_variables[207]].change_equip_by_id(1, b)
    c = $game_variables[204][2]
    $game_actors[$game_variables[207]].change_equip_by_id(2, c)
    d = $game_variables[204][3]
    $game_actors[$game_variables[207]].change_equip_by_id(3, d)
    e = $game_variables[204][4]
    $game_actors[$game_variables[207]].change_equip_by_id(4, e)
    $game_variables[207] = 0
    return_scene
  end
  #--------------------------------------------------------------------------
  # * [LLoadout 2] Command
  #--------------------------------------------------------------------------
  def command_LLode2
    Sound.play_equip
    a = $game_variables[205][0]
    $game_actors[$game_variables[207]].change_equip_by_id(0, a)
    b = $game_variables[205][1]
    $game_actors[$game_variables[207]].change_equip_by_id(1, b)
    c = $game_variables[205][2]
    $game_actors[$game_variables[207]].change_equip_by_id(2, c)
    d = $game_variables[205][3]
    $game_actors[$game_variables[207]].change_equip_by_id(3, d)
    e = $game_variables[205][4]
    $game_actors[$game_variables[207]].change_equip_by_id(4, e)
    $game_variables[207] = 0
    return_scene
  end
  #--------------------------------------------------------------------------
  # * [LLoadout 3] Command
  #--------------------------------------------------------------------------
  def command_LLode3
    Sound.play_equip
    a = $game_variables[206][0]
    $game_actors[$game_variables[207]].change_equip_by_id(0, a)
    b = $game_variables[206][1]
    $game_actors[$game_variables[207]].change_equip_by_id(1, b)
    c = $game_variables[206][2]
    $game_actors[$game_variables[207]].change_equip_by_id(2, c)
    d = $game_variables[206][3]
    $game_actors[$game_variables[207]].change_equip_by_id(3, d)
    e = $game_variables[206][4]
    $game_actors[$game_variables[207]].change_equip_by_id(4, e)
    $game_variables[207] = 0
    return_scene
  end
end

class Window_LLoadout < Window_Command
  def make_command_list
    add_command("Slot 1", :LLoadout1)
    add_command("Slot 2", :LLoadout2)
    add_command("Slot 3", :LLoadout3)
    add_command("Cancel", :cancel)
  end
end