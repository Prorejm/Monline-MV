#==============================================================================
# ** Scene_Loadout
#------------------------------------------------------------------------------
#  This class performs screen processing for gear loadouts.
#==============================================================================

class Scene_SaveLoadout < Scene_MenuBase
  
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
    @command_window = Window_SLoadout.new(px,py)
    @command_window.set_handler(:SLoadout1, method(:command_SLode1))
    @command_window.set_handler(:SLoadout2, method(:command_SLode2))
    @command_window.set_handler(:SLoadout3, method(:command_SLode3))
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
  # * [SLoadout 1] Command
  #--------------------------------------------------------------------------
  def command_SLode1
      $game_variables[204] = [0, 0, 0, 0, 0]
      if !$game_actors[$game_variables[207]].equips[0].nil?
        $game_variables[204][0] = $game_actors[$game_variables[207]].equips[0].id
      end
      if !$game_actors[$game_variables[207]].equips[1].nil?
        $game_variables[204][1] = $game_actors[$game_variables[207]].equips[1].id
      end
      if !$game_actors[$game_variables[207]].equips[2].nil?
        $game_variables[204][2] = $game_actors[$game_variables[207]].equips[2].id
      end
      if !$game_actors[$game_variables[207]].equips[3].nil?
        $game_variables[204][3] = $game_actors[$game_variables[207]].equips[3].id
      end
      if !$game_actors[$game_variables[207]].equips[4].nil?
        $game_variables[204][4] = $game_actors[$game_variables[207]].equips[4].id
      end
      $game_variables[207] = 0
      return_scene
  end
  #--------------------------------------------------------------------------
  # * [SLoadout 2] Command
  #--------------------------------------------------------------------------
  def command_SLode2
      $game_variables[205] = [0, 0, 0, 0, 0]
      if !$game_actors[$game_variables[207]].equips[0].nil?
        $game_variables[205][0] = $game_actors[$game_variables[207]].equips[0].id
      end
      if !$game_actors[$game_variables[207]].equips[1].nil?
        $game_variables[205][1] = $game_actors[$game_variables[207]].equips[1].id
      end
      if !$game_actors[$game_variables[207]].equips[2].nil?
        $game_variables[205][2] = $game_actors[$game_variables[207]].equips[2].id
      end
      if !$game_actors[$game_variables[207]].equips[3].nil?
        $game_variables[205][3] = $game_actors[$game_variables[207]].equips[3].id
      end
      if !$game_actors[$game_variables[207]].equips[4].nil?
        $game_variables[205][4] = $game_actors[$game_variables[207]].equips[4].id
      end
      $game_variables[207] = 0
      return_scene
  end
  #--------------------------------------------------------------------------
  # * [SLoadout 3] Command
  #--------------------------------------------------------------------------
  def command_SLode3
      $game_variables[206] = [0, 0, 0, 0, 0]
      if !$game_actors[$game_variables[207]].equips[0].nil?
        $game_variables[206][0] = $game_actors[$game_variables[207]].equips[0].id
      end
      if !$game_actors[$game_variables[207]].equips[1].nil?
        $game_variables[206][1] = $game_actors[$game_variables[207]].equips[1].id
      end
      if !$game_actors[$game_variables[207]].equips[2].nil?
        $game_variables[206][2] = $game_actors[$game_variables[207]].equips[2].id
      end
      if !$game_actors[$game_variables[207]].equips[3].nil?
        $game_variables[206][3] = $game_actors[$game_variables[207]].equips[3].id
      end
      if !$game_actors[$game_variables[207]].equips[4].nil?
        $game_variables[206][4] = $game_actors[$game_variables[207]].equips[4].id
      end
      $game_variables[207] = 0
      return_scene
  end

end

class Window_SLoadout < Window_Command
  def make_command_list
    add_command("Slot 1", :SLoadout1)
    add_command("Slot 2", :SLoadout2)
    add_command("Slot 3", :SLoadout3)
    add_command("Cancel", :cancel)
  end
end
