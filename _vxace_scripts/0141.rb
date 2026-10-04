#==============================================================================
# ** Victor Engine - Element Strengthen
#------------------------------------------------------------------------------
# Author : Victor Sant
#
# Version History:
#  v 1.00 - 2012.07.03 > First relase
#  v 1.01 - 2013.02.13 > Fixed issue with item effects
#------------------------------------------------------------------------------
#  This script allows to setup a trait that change the power of actions based
# on their elements. You can make the fire rod increase the power of fire based 
# spells.
#------------------------------------------------------------------------------
# Compatibility
#   Requires the script 'Victor Engine - Basic Module' v 1.35 or higher
#   If used with 'Victor Engine - Animated Battle' place this bellow it.
#   If used with 'Victor Engine - Element Set' place this bellow it.
#
# * Alias methods (Default)
#   class Game_Battler < Game_BattlerBase
#     def item_value_recover_hp(user, item, effect)
#     def item_value_recover_mp(user, item, effect)
#     def item_value_gain_tp(user, item, effect)
#     def item_element_rate(user, item)
#
#------------------------------------------------------------------------------
# Instructions:
#  To instal the script, open you script editor and paste this script on
#  a new section bellow the Materials section. This script must also
#  be bellow the script 'Victor Engine - Basic'
#
#------------------------------------------------------------------------------
# Actors, Classes, Enemies, Weapons, Armors and States note tags:
#   Tags to be used on Actors, Classes, Enemies, Weapons, Armors and States
#   note boxes.
#
#  <element strengthen x: +y%>
#  <element strengthen x: -y%>
#   Setup the element and a percent value of change in power
#     x : ID of the element
#     y : amount of change in element power
# 
#==============================================================================

#==============================================================================
# ** Victor Engine
#------------------------------------------------------------------------------
#   Setting module for the Victor Engine
#==============================================================================

module Victor_Engine
  #--------------------------------------------------------------------------
  # * Set how multiple element stregthen will be calculated
  #    Choose here how the elemental strengthen will be calculated when handling
  #    multiples values
  #    :highest  : use the highest value (default behavior)
  #    :addition : sum of all values
  #    :average  : average of all values
  #    :multiply : multiply all values
  #--------------------------------------------------------------------------
  VE_RESIST_ADDITION_TYPE = :addition
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
$imported[:ve_element_strengthen] = 1.01
Victor_Engine.required(:ve_element_strengthen, :ve_basic_module, 1.35, :above)

#==============================================================================
# ** Game_Battler
#------------------------------------------------------------------------------
#  This class deals with battlers. It's used as a superclass of the Game_Actor
# and Game_Enemy classes.
#==============================================================================

class Game_Battler < Game_BattlerBase
  #--------------------------------------------------------------------------
  # * Alias method: item_effect_recover_hp
  #--------------------------------------------------------------------------
  alias :item_value_recover_hp_ve_action_strengthen :item_value_recover_hp
  def item_value_recover_hp(user, item, effect)
    value = item_value_recover_hp_ve_action_strengthen(user, item, effect)
    value * user.element_strengthen(user.element_set(item))
  end
  #--------------------------------------------------------------------------
  # * Alias method: item_effect_recover_mp
  #--------------------------------------------------------------------------
  alias :item_value_recover_mp_ve_action_strengthen :item_value_recover_mp
  def item_value_recover_mp(user, item, effect)
    value = item_value_recover_mp_ve_action_strengthen(user, item, effect)
    value * user.element_strengthen(user.element_set(item))
  end
  #--------------------------------------------------------------------------
  # * Alias method: item_effect_recover_tp
  #--------------------------------------------------------------------------
  alias :item_value_recover_tp_ve_action_strengthen :item_value_recover_tp
  def item_value_recover_tp(user, item, effect)
    value = item_value_recover_tp_ve_action_strengthen(user, item, effect)
    value * user.element_strengthen(user.element_set(item))
  end
  #--------------------------------------------------------------------------
  # * Alias method: item_element_rate
  #--------------------------------------------------------------------------
  alias :item_element_rate_ve_element_strengthen :item_element_rate
  def item_element_rate(user, item)
    result = item_element_rate_ve_element_strengthen(user, item)
    result * user.element_strengthen(user.element_set(item))
  end
  #--------------------------------------------------------------------------
  # * New method: element_strengthen
  #--------------------------------------------------------------------------
  def element_strengthen(elements)
    case VE_RESIST_ADDITION_TYPE
    when :addition then addition_element_strengthen(elements)
    when :average  then average_element_strengthen(elements)
    when :multiply then multiply_element_strengthen(elements)
    else highest_element_strengthen(elements)
    end
  end
  #--------------------------------------------------------------------------
  # * New method: highest_element_strengthen
  #--------------------------------------------------------------------------
  def highest_element_strengthen(elements)
    result = elements.inject([]) {|r, i| r += get_element_strengthen(i) }
    result.inject([1.0]) {|r, i| r.push(i + 1.0) }.max
  end
  #--------------------------------------------------------------------------
  # * New method: addition_element_strengthen
  #--------------------------------------------------------------------------
  def addition_element_strengthen(elements)
    result = elements.inject([]) {|r, i| r += get_element_strengthen(i) }
    result.inject([1.0]) {|r, i| r.push(i) }.sum
  end
  #--------------------------------------------------------------------------
  # * New method: average_element_strengthen
  #--------------------------------------------------------------------------
  def average_element_strengthen(elements)
    result = elements.inject([]) {|r, i| r += get_element_strengthen(i) }
    result.inject([]) {|r, i| r.push(i) }.average + 1.0
  end
  #--------------------------------------------------------------------------
  # * New method: multiply_element_strengthen
  #--------------------------------------------------------------------------
  def multiply_element_strengthen(elements)
   result = elements.inject([]) {|r, i| r += get_element_strengthen(i) }
   result.inject(1.0) {|r, i| r *= i + 1.0 }
  end
  #--------------------------------------------------------------------------
  # * New method: get_element_strengthen
  #--------------------------------------------------------------------------
  def get_element_strengthen(id)
    regexp = /<ELEMENT STRENGTHEN #{id}: ([+-]?\d+)%?>/i
    list   = get_all_notes.scan(regexp).collect {|i| i.first.to_i / 100.0 }
  end
end