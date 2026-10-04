#==============================================================================
# # Global Save System [v1.0]
# # By theLEECH
#==============================================================================
# # Overwrites:
# # in module DataManager:
# # # self.load_game(index)
# # # self.save_game(index)
# # # self.setup_new_game
#==============================================================================
# ---INSTRUCTIONS---
# Put the numbers of the variables to save and the switches to save in the
# VARIABLES_TO_SAVE array, and the SWITCHES_TO_SAVE array.
# If you want to automatically load/update the globally saved data, set the
# SAVE_ON_SAVE LOAD_ON_LOAD and LOAD_ON_NEW flags to true accordingly.
#------------------------------------------------------------------------------
# You can load and save global data within an event, by using the script command
# and entering: "global_save" or "global_load" (Without qoutations)
#==============================================================================
#==============================================================================
# # LGlobalSave
#==============================================================================
module LGlobalSave

#==============================================================================
# CONFIGURATION
#==============================================================================
# Whether or not the variables and switches in the global file should be
# saved when the player saves the game
  SAVE_ON_SAVE = true
# Whether or not the variables and switches in the global file should be
# loaded when the player loads a save file
  LOAD_ON_LOAD = true
# Whether or not the variables and switches in the global file should be
# loaded when the player starts a new game
  LOAD_ON_NEW = true
# An array that contains a list of variables to save in the global save file
# Enter a list of variables, by number, seperated by commas.
# You can use '..' to include all variables between two numbers
# Example: 15..42
# Will include all variables or switches between 15 and 42 (inclusive)
# Leave blank to save none of that type
  VARIABLES_TO_SAVE = []
# Same as above, but for switches
  SWITCHES_TO_SAVE = []
# The name of the file to save global variables and switches in
  FILE_NAME = "Global.rvdata2"
#==============================================================================
# END OF CONFIGURATION
#==============================================================================

  def self.saveTheFile(f)
    File.open(FILE_NAME, "wb") do |file|
      Marshal.dump(f, file)
    end
  end

  def self.loadTheFile
    if !File.exists?(LGlobalSave::FILE_NAME)
      f = makeNewFile
      return f
    else
        f = nil
      File.open(FILE_NAME, "rb") do |file|
        f = Marshal.load(file)
      end
      return f
    end
  end

  def self.makeNewFile
    return LGlobalSaveFile.new
  end

  def self.loadVariables(f)
    for i in VARIABLES_TO_SAVE
      $game_variables[i]= f.getVar(i)
    end
  end

  def self.loadSwitches(f)
    for i in SWITCHES_TO_SAVE
      $game_switches[i]= f.getSwitch(i)
    end
  end

  def self.saveVariables(f)
    for i in VARIABLES_TO_SAVE
      f.setVar(i, $game_variables[i])
    end
  end

  def self.saveSwitches(f)
    for i in SWITCHES_TO_SAVE
      f.setSwitch(i, $game_switches[i])
    end
  end

  def self.save
    f = makeNewFile
    saveVariables(f)
    saveSwitches(f)
    saveTheFile(f)
  end

  def self.load
    f = loadTheFile
    loadVariables(f)
    loadSwitches(f)
  end

end # end of module LGlobalSave

#==============================================================================
# ** LGlobalSaveFile
#------------------------------------------------------------------------------
# An object of this class is saved in the global.sav file
# It contains all the saved variables and switches
#==============================================================================
class LGlobalSaveFile

  def initialize # Initializes the object
    @var = []
    @switch = []
  end

# @var holds the saved variables
# set and get methods:
  def getVar(id)
    return @var[id]
  end
  def setVar(id, val)
    @var[id] = val
  end

# @switch holds the saved switches
# set and get methods:
  def getSwitch(id)
    return @switch[id]
  end
  def setSwitch(id, val)
    @switch[id] = val
  end

end # end of class LGlobalSaveFile

#==============================================================================
# These methods are for saving and loading the global save file from an event
#==============================================================================
def global_save
  LGlobalSave.save
end
def global_load
  LGlobalSave.load
end
#==============================================================================
# ** DataManager
#==============================================================================
module DataManager

#--------------------------------------------------------------------------
# overwrite method: self.setup_new_game
#--------------------------------------------------------------------------
  def self.setup_new_game
    create_game_objects
    $game_party.setup_starting_members
    $game_map.setup($data_system.start_map_id)
    $game_player.moveto($data_system.start_x, $data_system.start_y)
    $game_player.refresh
    Graphics.frame_count = 0
    LGlobalSave.load if LGlobalSave::LOAD_ON_NEW
  end

#--------------------------------------------------------------------------
# overwrite method: self.save_game(index)
#--------------------------------------------------------------------------
  def self.save_game(index)
    begin
      save_game_without_rescue(index)
    rescue
      delete_save_file(index)
      false
    end
    LGlobalSave.save if LGlobalSave::SAVE_ON_SAVE
  end

#--------------------------------------------------------------------------
# overwrite method: self.load_game(index)
#--------------------------------------------------------------------------
  def self.load_game(index)
    load_game_without_rescue(index) rescue false
    LGlobalSave.load if LGlobalSave::LOAD_ON_LOAD
  end
end # end of module DataManager