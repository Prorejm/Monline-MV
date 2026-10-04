#==============================================================================
# ** Victor Engine - Passive States
#------------------------------------------------------------------------------
# Author : Victor Sant
#
# Version History:
#  v 1.00 - 2012.03.19 > First release
#  v 1.01 - 2012.05.22 > Fixed bug with some condtions
#  v 1.02 - 2012.07.08 > Setup changed, now it's possible to setup different
#                      > conditions for states on the same object
#  v 1.03 - 2012.08.02 > Compatibility with Basic Module 1.27
#------------------------------------------------------------------------------
#  This scripts allows to setup passive states for actors, equipment, skills
# states, and enemies. These states will be always active. It's possible also
# to setup conditions for the passive states to take effect
#------------------------------------------------------------------------------
# Compatibility
#   Requires the script 'Victor Engine - Basic Module' v 1.27 or higher
#
# * Alias methods
#   class Game_BattlerBase
#     def initialize
#     def refresh
#
#   class Game_Battler < Game_BattlerBase
#     def add_state(state_id)
#     def remove_state(state_id)
#     def erase_state(state_id)
#
#   class Game_Actor < Game_Battler
#     def setup(actor_id)
#     def learn_skill(skill_id)
#     def forget_skill(skill_id)
#
#------------------------------------------------------------------------------
# Instructions:
#  To instal the script, open you script editor and paste this script on
#  a new section bellow the Materials section. This script must also
#  be bellow the script 'Victor Engine - Basic'
#
#------------------------------------------------------------------------------
# Actors, Classes, Wapons, Armors, States, Enemies and Skills note tags:
#   Tags to be used on  Actors, Classes, Wapons, Armors, States, Enemies and
#   Skill note boxes.
#
#  <passive state: id, id>
#  conditions;
#  </passive state>
#
#   Setup the state ID, trigger and conditions to apply the state
#     id         : state IDs, you can add how many ids you want
#     conditions : conditions that must be met to the state be applied
#
#    Conditions: conditions that must be met to the state be applied
#      the conditions can be status based or a custom script call
#      you can add how many values you want always separating them with a ;
#      at the end. Script calls can have multiple lines, just add the ; at
#      the end of the last condition.
#    stat higher x      stat equal x
#    stat higher x%     stat equal x%
#    stat lower x       stat different x
#    stat lower x%      stat different x%
#      The state add conditions will be valid if the stat set meets the
#      condition when compared with value y. You can use any stat
#      available for the battler,   even custom ones.
#        stat : stat name (maxhp, maxmp, maxtp, hp, mp, tp, atk, def, mat...)
#        x    : value (can be evaluted), % value can only be used with
#               the stats "hp", "mp" and "tp"
# 
#------------------------------------------------------------------------------
# Additional instructions:
#
#  Settings from versions previous to 1.02 will not work properly
#  
#  If you want a state that is ALWAYS applied, just set the condition true;
#
#------------------------------------------------------------------------------
# Example states:
# 
#  <passive state: 14>
#  true;
#  </passive state>
#    The state ID 14 is always applied
#
#  <passive state: 24, 25>
#  hp equal 100%;
#  </passive state>
#    Apply the states ID 24 and 25 if the HP is full.
#
#  <passive state: 20>
#  $game_switches[1] || $game_switches[2];
#  </passive state>
#   Apply state ID 20 if Switch ID 1 or 2 is turned ON
#
#------------------------------------------------------------------------------
# Useful script calls:
#   Here some useful script calls that can be used:
#
#   state?(x)
#    checks if the battler is under state ID x
#
#   state_addable?(x)
#    checks if the state ID x can be added (to avoid adding the state if the
#    battler is immune)
# 
#   $game_swiches[x]
#    checks if game swicth ID x is ON
#
#   $game_variables[x]
#    you can use this to compare the variable ID x with any value (be sure to
#    to add the comparision sign and the value)
#
#   you can also use || for "or" and && for "and"
#     state?(1) || state?(2) # if state 1 or state 2 is added
#     state?(1) && state?(2) # if boths state 1 and state 2 are added
#   
#   you can also add a ! in front of the condition to make the opposite check
#     !state?(2)         # if state 2 is NOT added
#     !$game_switches[3] # if Switch 3 is OFF
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
$imported[:ve_passive_states] = 1.03
Victor_Engine.required(:ve_passive_states, :ve_basic_module, 1.27, :above)

#==============================================================================
# ** Game_BattlerBase
#------------------------------------------------------------------------------
#  This class handles battlers. It's used as a superclass of the Game_Battler
# classes.
#==============================================================================

class Game_BattlerBase
  #--------------------------------------------------------------------------
  # * Alias method: initialize
  #--------------------------------------------------------------------------
  alias :initialize_ve_passive_states :initialize
  def initialize
    @passive_states = []
    initialize_ve_passive_states
  end
  #--------------------------------------------------------------------------
  # * Alias method: refresh
  #--------------------------------------------------------------------------
  alias :refresh_ve_passive_states :refresh
  def refresh
    refresh_passive_states
    refresh_ve_passive_states
  end
  #--------------------------------------------------------------------------
  # * New method: refresh_passive_states
  #--------------------------------------------------------------------------
  def refresh_passive_states
    remove_passive_states
    add_passive_states
  end
  #--------------------------------------------------------------------------
  # * New method: add_passive_states
  #--------------------------------------------------------------------------
  def add_passive_states
    setup_passive_states(get_all_notes)
    skills.compact.each {|skill| setup_passive_states(skill.note) } if actor?
  end
  #--------------------------------------------------------------------------
  # * New method: remove_passive_states
  #--------------------------------------------------------------------------
  def remove_passive_states
    passive_states = @passive_states.dup
    @passive_states.clear
    passive_states.each {|state| erase_state(state) }
  end
  #--------------------------------------------------------------------------
  # * New method: setup_passive_states
  #--------------------------------------------------------------------------
  def setup_passive_states(notes)
    value  = "PASSIVE STATE"
    regexp = get_all_values("#{value}: ((?:\\d+ *,? *)+)", value)
    notes.scan(regexp) do
      state = $1.dup
      notes = $2.dup
      next if !passive_state_condition(notes)
      state.scan(/(\d+)/i) { add_passive_state($1.to_i) }
    end
  end
  #--------------------------------------------------------------------------
  # * New method: passive_state_condition
  #--------------------------------------------------------------------------
  def passive_state_condition(notes)
    notes.scan(/([^;]*);/im) do
      value  = $1.dup
      result = value =~ /\w+ (?:HIGHER|LOWER|EQUAL|DIFFERENT) [^><]*/i
      return false if  result && !passive_state_stat?(value)
      return false if !result && !passive_state_custom?(value)
    end
    return true
  end
  #--------------------------------------------------------------------------
  # * New method: passive_state_stat?
  #--------------------------------------------------------------------------
  def passive_state_stat?(notes)
    if notes =~ /(\w+) (HIGHER|LOWER|EQUAL|DIFFERENT) ([^><]*)/im
      stat  = $1.dup
      cond  = $2.dup
      value = $3.dup
      if value =~ /(\d+)\%/i and ["HP","MP","TP"].include?(stat.upcase)
        return eval("#{stat.downcase}_rate * 100 #{get_cond(cond)} #{$1}")
      else
        return eval("#{get_param(stat)} #{get_cond(cond)} #{value}")
      end
    end
  end
  #--------------------------------------------------------------------------
  # * New method: passive_state_custom?
  #--------------------------------------------------------------------------
  def passive_state_custom?(notes)
    eval("#{notes.gsub(/\r\n/i, ";")}") rescue false
  end
  #--------------------------------------------------------------------------
  # * New method: add_passive_state
  #--------------------------------------------------------------------------
  def add_passive_state(state_id)
    return if @passive_states.include?(state_id)
    return if @states.include?(state_id) || !alive?
    @passive_states.push(state_id)
    @states.push(state_id)
    reset_state_counts(state_id)
    sort_states
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
  # * Alias method: add_state
  #--------------------------------------------------------------------------
  alias :add_state_ve_passive_states :add_state
  def add_state(state_id)
    @passive_states.delete(state_id) if state_addable?(state_id)
    add_state_ve_passive_states(state_id)
  end
  #--------------------------------------------------------------------------
  # * Alias method: remove_state
  #--------------------------------------------------------------------------
  alias :remove_state_ve_passive_states :remove_state
  def remove_state(state_id)
    return if @passive_states.include?(state_id)
    remove_state_ve_passive_states(state_id)
  end
  #--------------------------------------------------------------------------
  # * Alias method: erase_state
  #--------------------------------------------------------------------------
  alias :erase_state_ve_passive_states :erase_state
  def erase_state(state_id)
    return if @passive_states.include?(state_id)
    erase_state_ve_passive_states(state_id)
  end
end

#==============================================================================
# ** Game_Party
#------------------------------------------------------------------------------
#  This class handles the party. It includes information on amount of gold 
# and items. The instance of this class is referenced by $game_party.
#==============================================================================

class Game_Party < Game_Unit
  #--------------------------------------------------------------------------
  # * New method: refresh_passive_states
  #--------------------------------------------------------------------------
  def refresh_passive_states
    members.each {|member| member.refresh_passive_states }
  end
end

#==============================================================================
# ** Scene_Base
#------------------------------------------------------------------------------
#  This is a superclass of all scenes in the game.
#==============================================================================

class Scene_Base
  #--------------------------------------------------------------------------
  # * Alias method: start
  #--------------------------------------------------------------------------
  alias :start_ve_passive_states :start
  def start
    start_ve_passive_states
    $game_party.refresh_passive_states if $game_party
  end
end