#==============================================================================
# ** Scene_PXEBestChoose
#------------------------------------------------------------------------------
#  This class performs screen processing for picking between PXEPedia and 
#  the bestiary.
#==============================================================================

class Scene_PXEBestChoose < Scene_MenuBase
  
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
    @command_window = Window_PXEBestiary.new(px,py)
    @command_window.set_handler(:to_pedia, method(:command_to_pedia))
    @command_window.set_handler(:to_bestiary, method(:command_to_bestiary))
    @command_window.set_handler(:to_pxeshop, method(:command_to_pxeshop))
    @command_window.set_handler(:to_pxelearn, method(:command_to_pxelearn))
    @command_window.set_handler(:to_pxeequip, method(:command_to_pxeequip))
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
  # * [Go to Pedia] Command
  #--------------------------------------------------------------------------
  def command_to_pedia
    close_command_window
    SceneManager.call(Encyclopedia)
  end
  #--------------------------------------------------------------------------
  # * [Go to Bestiary] Command
  #--------------------------------------------------------------------------
  def command_to_bestiary
    close_command_window
    SceneManager.call(Scene_MonsterCatalogue)
  end
  #--------------------------------------------------------------------------
  # * [Go to PXEShop] Command
  #--------------------------------------------------------------------------
  def command_to_pxeshop
    SceneManager.call(Scene_Map)
    $game_temp.reserve_common_event(82)
  end
  #--------------------------------------------------------------------------
  # * [Go to PXELearn] Command
  #--------------------------------------------------------------------------
  def command_to_pxelearn
    $game_party.menu_actor = $game_actors[25]
    SceneManager.call(Scene_LearnSkill)
  end
  #--------------------------------------------------------------------------
  # * [Go to PXEEquip] Command
  #--------------------------------------------------------------------------
  def command_to_pxeequip
    $game_party.menu_actor = $game_actors[25]
    SceneManager.call(Scene_Equip)
  end
end

class Window_PXEBestiary < Window_Command
  def make_command_list
    add_command("PXEpedia", :to_pedia)
    add_command("Bestiary", :to_bestiary)
    if $game_party.in_battle == false #Out of Battle Check (Not used)
      if $game_switches[280] == true #PXE is Navigating
        add_command("Functions", :to_pxelearn)
        if $game_actors[25].skills.include?($data_skills[758]) #Augment Function Unlocked
          add_command("Augment", :to_pxeequip)
        end
        if $game_actors[25].skills.include?($data_skills[752]) #PXEShop Function Unlocked
          add_command("PXE Shop", :to_pxeshop)
        end
      end
    end
    add_command("Return", :cancel)
  end
end
