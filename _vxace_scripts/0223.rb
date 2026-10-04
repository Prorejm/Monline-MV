#==============================================================================
# ** Victor Engine - Incapacitate States
#------------------------------------------------------------------------------
# Author : Victor Sant
#
# Version History:
#  v 1.00 - 2012.06.21 > First release
#------------------------------------------------------------------------------
#  This script allows setup states that makes the character to be set as
# dead even if not actually dead, an example is a petrification state.
# If all characters are hit by this state, it's game over.
# Also you can set states that kills the target when hit, that way you can
# make custom death spells that don't rely on death resistance, like a undead
# banishing spell.
#------------------------------------------------------------------------------
# Compatibility
#   Requires the script 'Victor Engine - Basic Module'
#
# * Alias methods (Default)
#   class Game_Battler < Game_BattlerBase
#     def add_new_state(state_id)
#
#   class Game_Unit
#     def all_dead?
#
#------------------------------------------------------------------------------
# Instructions:
#  To instal the script, open you script editor and paste this script on
#  a new section bellow the Materials section. This script must also
#  be bellow the script 'Victor Engine - Basic'
#
#------------------------------------------------------------------------------
# States note tags:
#   Tags to be used on States note boxes.
#
#  <incapacitate state>
#   States with this tag will make the battler to be considered dead, even
#   if not actually dead.
#
#  <kill state>
#   This tag will make target dies when the state is applied, there's no way to
#   to resist the death effect once the states hit, the state itself can be
#   resisted.
#
#------------------------------------------------------------------------------
# Additional instructions:
#   The <incapacitate state> tag makes the target to be considered dead only
#   for the game over check, the target can still act freely unless you set
#   an action restriction to the state.
#
#   The <kill state> tag is used to skip the death state resistance, so you
#   can make targets imune to the default death state, but can still be target
#   to custom death spells, like an unedead, imune to death, but weak to 
#   undead banish spells.
#
#==============================================================================

#==============================================================================
# ** Victor Engine
#------------------------------------------------------------------------------
#   Setting module for the Victor Engine
#==============================================================================

module Victor_Engine
  #--------------------------------------------------------------------------
  # * required
  #   This method checks for the existance of the basic module and other
  #   VE scripts required for this script to work, don't edit this
  #--------------------------------------------------------------------------
  def self.required(name, req, version, type = nil)
    if !$imported[:ve_basic_module]
      msg = "The script '%s' requires the script\n"
      msg += "'VE - Basic Module' v%s or higher above it to work properly\n"
      msg += "Go to http://victorenginescripts.wordpress.com/ to download this script."
      msgbox(sprintf(msg, self.script_name(name), version))
      exit
    else
      self.required_script(name, req, version, type)
    end
  end
  #--------------------------------------------------------------------------
  # * script_name
  #   Get the script name base on the imported value
  #--------------------------------------------------------------------------
  def self.script_name(name, ext = "VE")
    name = name.to_s.gsub("_", " ").upcase.split
    name.collect! {|char| char == ext ? "#{char} -" : char.capitalize }
    name.join(" ")
  end
end

$imported ||= {}
$imported[:ve_incapacitate_states] = 1.00
Victor_Engine.required(:ve_incapacitate_states, :ve_basic_module, 1.00, :above)

#==============================================================================
# ** RPG::State
#------------------------------------------------------------------------------
#  This is the data class for states
#==============================================================================

class RPG::State < RPG::BaseItem
  #--------------------------------------------------------------------------
  # * New method: incapacitate_state?
  #--------------------------------------------------------------------------
  def incapacitate_state?
    note =~ /<INCAPACITATE STATE>/i
  end
  #--------------------------------------------------------------------------
  # * New method: kill_state?
  #--------------------------------------------------------------------------
  def kill_state?
    note =~ /<KILL STATE>/i
  end
end

#==============================================================================
# ** Game_Battler
#------------------------------------------------------------------------------
#  This class deals with battlers. It's used as a superclass of the Game_Actor
# and Game_Enemy classes.
#==============================================================================

class Game_Battler < Game_BattlerBase
  #--------------------------------------------------------------------------
  # * Alias method: add_new_state
  #--------------------------------------------------------------------------
  alias :add_new_state_ve_incapacitate_states :add_new_state
  def add_new_state(state_id)
    die if $data_states[state_id].kill_state?
    add_new_state_ve_incapacitate_states(state_id)
  end
  #--------------------------------------------------------------------------
  # * New method: incapacitated?
  #--------------------------------------------------------------------------
  def incapacitated?
    states.any? {|state| state.incapacitate_state? }
  end
end

#==============================================================================
# ** Game_Unit
#------------------------------------------------------------------------------
#  This class handles units. It's used as a superclass of the Game_Party and
# Game_Troop classes.
#==============================================================================

class Game_Unit
  #--------------------------------------------------------------------------
  # * Alias method: all_dead?
  #--------------------------------------------------------------------------
  alias :all_dead_ve_incapacitate_states? :all_dead?
  def all_dead?
    all_dead_ve_incapacitate_states? || all_incapacitated?
  end
  #--------------------------------------------------------------------------
  # * New method: all_incapacitated?
  #--------------------------------------------------------------------------
  def all_incapacitated?
    alive_members.all? {|member| member.incapacitated? }
  end
end