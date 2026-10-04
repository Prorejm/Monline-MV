#==============================================================================
# ** Victor Engine - Critical Hit Effects
#------------------------------------------------------------------------------
# Author : Victor Sant
#
# Version History:
#  v 1.00 - 2012.07.17 > First release
#  v 1.01 - 2013.01.07 > Compatibility with Basic Module v 1.34
#                      > Fixed issue with <critical state add: x, y%> notetag
#------------------------------------------------------------------------------
#  This script allows to have better control over critical rate, damage and
# stup states to be changed when dealing critical damage.
#------------------------------------------------------------------------------
# Compatibility
#   Requires the script 'Victor Engine - Basic Module' v 1.34 or higher.
#
# * Overwrite methods
#   class Game_Battler < Game_BattlerBase
#     def item_cri(user, item)
#     def apply_critical(damage)
#
# * Alias methods
#   class Game_Battler < Game_BattlerBase
#     def make_damage_value(user, item)
#     def cri_rate(item)
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
#  <critical damage: +x%>
#  <critical damage: -x%>
#   Changes the critical damage rate for the battler
#     x : critical damage rate change
#
#  <critical defense: +x%>
#  <critical defense: -x%>
#   Reduces the rate of critical damage received
#     x : critical damage rate change
#
#  <critical state add: x, y%>
#   Adds state then deal critical damage for the battler
#     x : state ID
#     y : chance of occuring
#
#  <critical state remove: x, y%>
#   Removes state then deal critical damage for the battler
#     x : state ID
#     y : chance of occuring
#
#------------------------------------------------------------------------------
#  Skills and Items note tags:
#   Tags to be used on Skills and Items note boxes.
#
#  <critical rate: +x%>
#  <critical rate: -x%>
#   Changes the critical rate for that skill or item
#     x : critical rate change
#
#  <critical damage: +x%>
#  <critical damage: -x%>
#   Changes the critical damage rate for that skill or item
#     x : critical damage rate change
#
#  <critical state add: x, y>
#   Adds state then deal critical damage with this skill or item
#     x : state ID
#     y : chance of occuring
#
#  <critical state remove: x, y>
#   Removes state then deal critical damage with this skill or item
#     x : state ID
#     y : chance of occuring
#
#------------------------------------------------------------------------------
# Additional instructions:
#
#  The Critical Defense value is a value of reduction over the Critical
#  Damage value. So it will reduce the additional value granted by the
#  critical, but not the normal damage value.
#
#  An attack that deals 1000 damage, with 250% of critical additional damage
#  would deal 3500 damage (1000 + 1000 * 250%). The critical defense will have
#  effect only over the 250% additional. So an 50% critical defense will reduce
#  the 250% by half: to 125% additional damage. Wich will result in a final
#  damage of 2250 (1000 + 1000 * 125%)
#  A Critical Defense of 100% will nullify the critical additional damage, so
#  the damage will be the same of a non critical attack.
#
#  Critical Damage otherwise stacks, so a base value of 200% + a skill that
#  increase 50% will result in a 250% additional damage.
# 
#==============================================================================

#==============================================================================
# ** Victor Engine
#------------------------------------------------------------------------------
#   Setting module for the Victor Engine
#==============================================================================

module Victor_Engine
  #--------------------------------------------------------------------------
  # * Base critical hit damage rate, this rate is added to the normal
  #   damage rate when dealing critical damage
  #   It's a rate value, so 100 = double damage (since the normal attack deals
  #   100% damage, +100% from the critical the damage become 200%)
  #--------------------------------------------------------------------------
  VE_BASE_CRITICAL_DAMAGE = 200
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
$imported[:ve_critical_hit_effects] = 1.01
Victor_Engine.required(:ve_critical_hit_effects, :ve_basic_module, 1.34, :above)

#==============================================================================
# ** RPG::UsableItem
#------------------------------------------------------------------------------
#  This is the superclass for skills and items.
#==============================================================================

class RPG::UsableItem < RPG::BaseItem
  #--------------------------------------------------------------------------
  # * New method: cri
  #--------------------------------------------------------------------------
  def cri
    note =~ /<CRITICAL RATE: ([+-]?\d+)%?>/i ? $1.to_i / 100.0 : 0
  end
  #--------------------------------------------------------------------------
  # * New method: cri_dmg
  #--------------------------------------------------------------------------
  def cri_dmg
    note =~ /<CRITICAL DAMAGE: ([+-]?\d+)%?>/i ? $1.to_i : 0
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
  # * Overwrite method: item_cri
  #--------------------------------------------------------------------------
  def item_cri(user, item)
    item.damage.critical ? setup_critical(user, item) : 0
  end
  #--------------------------------------------------------------------------
  # * Overwrite method: apply_critical
  #--------------------------------------------------------------------------
  def apply_critical(damage)
    damage * @cri_mult
  end
  #--------------------------------------------------------------------------
  # * Alias method: make_damage_value
  #--------------------------------------------------------------------------
  alias :make_damage_value_ve_make_damage_value :make_damage_value
  def make_damage_value(user, item)
    critical_effects(user, item) if @result.critical
    make_damage_value_ve_make_damage_value(user, item)
  end
  #--------------------------------------------------------------------------
  # * Alias method: cri_rate
  #--------------------------------------------------------------------------
  alias :cri_rate_ve_critical_hit_effects :cri_rate
  def cri_rate(user, item)
    cri_rate_ve_critical_hit_effects(user, item) + item.cri
  end
  #--------------------------------------------------------------------------
  # * New method: critical_effects
  #--------------------------------------------------------------------------
  def critical_effects(user, item)
    @cri_mult = [1 + (user.cri_dmg + item.cri_dmg) * (1 - cri_def), 1].max
    critical_state_add(user, item)
    critical_state_remove(user, item)
  end
  #--------------------------------------------------------------------------
  # * New method: cri_dmg
  #--------------------------------------------------------------------------
  def cri_dmg
    base   = VE_BASE_CRITICAL_DAMAGE / 100.0
    regexp = /<CRITICAL DAMAGE: ([+-]?\d+)%?>/i
    get_all_notes.scan(regexp).inject(base) {|r, i| r += $1.to_f / 100.0 }
  end
  #--------------------------------------------------------------------------
  # * New method: cri_def
  #--------------------------------------------------------------------------
  def cri_def
    regexp = /<CRITICAL DEFENSE: ([+-]?\d+)%?>/i
    get_all_notes.scan(regexp).inject(0.0) {|r, i| r += $1.to_f / 100.0 }
  end
  #--------------------------------------------------------------------------
  # * New method: critical_state_add
  #--------------------------------------------------------------------------
  def critical_state_add(user, item)
    regexp = /<CRITICAL STATE ADD: (\d+), (\d+)%?>/i
    notes  = item.note + user.get_all_notes
    notes.scan(regexp) do |id, rate|
      add_state_normal(id.to_i, rate.to_f / 100.0, user)
    end
  end
  #--------------------------------------------------------------------------
  # * New method: critical_state_remove
  #--------------------------------------------------------------------------
  def critical_state_remove(user, item)
    regexp = /<CRITICAL STATE REMOVE: (\d+), (\d+)%?>/i
    notes  = item.note + user.get_all_notes
    notes.scan(regexp) do |id, rate|
      remove_state(id.to_i) if rand < (rate.to_f / 100.0)
    end
  end
end
