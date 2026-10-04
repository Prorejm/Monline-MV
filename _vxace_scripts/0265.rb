#:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=
#  ▼ Dual wield / two-handed fix
#  Author: Trihan
#  Version 1
#  Release date: 28/06/13
#:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=

#------------------------------------------------------------------------------
#  ▼ UPDATES
#------------------------------------------------------------------------------
# 28/06/13 - First release
#------------------------------------------------------------------------------
#  ▼ TERMS OF USAGE
#------------------------------------------------------------------------------
# This script may be used for any purpose with or without credit, though a
# little mention would be nice.
#------------------------------------------------------------------------------
#  ▼ INTRODUCTION 
#------------------------------------------------------------------------------
# This script "fixes" two-handed weapons for dual wielders; by default VX Ace
# has no checks in place to prevent a weapon that seals shield being equipped
# in both hands, because dual wielders have two weapon slots instead of a
# shield slot.
#------------------------------------------------------------------------------
#  ▼ INSTRUCTIONS
#------------------------------------------------------------------------------
# All you have to do is make the weapon you want to make two-handed "seal
# shield" and the script will do the rest for you.
#------------------------------------------------------------------------------
#  ▼ COMPATIBILITY
#------------------------------------------------------------------------------
# There should be few if any compatibility issues with this script; the only
# directly overloaded method is release_unequippable_items, so if you're using
# a script that modifies this some edits may be required.
#------------------------------------------------------------------------------
$imported = {} if $imported.nil?
$imported['tridw2hfix'] = true

#==============================================================================
# ** RPG::Weapon
#------------------------------------------------------------------------------
# Base class for equippable weapons.
# NEW METHOD - two_handed?
#==============================================================================
class RPG::Weapon < RPG::EquipItem
  #--------------------------------------------------------------------------
  # * Determine whether weapon requires two hands (seals shield)
  #--------------------------------------------------------------------------
  def two_handed?
    for feature in self.features
      if feature.code == 54 && feature.data_id == 1
        return true
      end
    end
    return false
  end
end

#==============================================================================
# ** Game_BattlerBase
#------------------------------------------------------------------------------
# ALIASED METHOD - equippable?
#==============================================================================
class Game_BattlerBase
  #--------------------------------------------------------------------------
  # * Determine if Equippable
  #--------------------------------------------------------------------------
  alias tri_dw2hfix_equippable? equippable?
  # Need to add a parameter for slot so we can check slot-specific setups.
  def equippable?(item, slot = nil)
    if slot != nil
      # If the current slot is "off-hand" AND the character dual-wields AND
      # the item being equipped is a weapon AND something is already equipped
      # in the main hand AND the main hand weapon is two-handed...
      if slot == 1 && dual_wield? && item.is_a?(RPG::Weapon) && equips[0] && equips[0].two_handed?
        return false
      end
    end
    # Call the original method to continue default equippable checks.
    tri_dw2hfix_equippable?(item)
  end
end

#==============================================================================
# ** Game_Actor
#------------------------------------------------------------------------------
# OVERLOADED METHOD - release_unequippable_items
#==============================================================================
class Game_Actor < Game_Battler
  #--------------------------------------------------------------------------
  # * Remove Equipment that Cannot Be Equipped 
  #     item_gain:  Return removed equipment to party.
  #--------------------------------------------------------------------------
  def release_unequippable_items(item_gain = true)
    loop do
      last_equips = equips.dup
      @equips.each_with_index do |item, i|
        # Changed to include index as a parameter to equippable? so we know
        # which slot is being checked.
        if !equippable?(item.object, i) || item.object.etype_id != equip_slots[i]
          trade_item_with_party(nil, item.object) if item_gain
          item.object = nil
        end
      end
      return if equips == last_equips
    end
  end
end

#==============================================================================
# ** Window_EquipSlot
#------------------------------------------------------------------------------
# ALIASED METHOD - enable?
#==============================================================================
class Window_EquipSlot < Window_Selectable
  #--------------------------------------------------------------------------
  # * Display Equipment Slot in Enabled State?
  #--------------------------------------------------------------------------
  alias tri_dw2hfix_enable? enable?
  def enable?(index)
    # if the actor dual wields AND current index is that of the off-hand AND
    # there's something equipped in the main hand AND it's two-handed...
    if @actor.dual_wield? && index == 1 && @actor.equips[0] && @actor.equips[0].two_handed?
      return false
    end
    tri_dw2hfix_enable?(index)
  end
end
  
#==============================================================================
# ** Window_EquipItem
#------------------------------------------------------------------------------
# ALIASED METHOD - include?
#==============================================================================
class Window_EquipItem < Window_ItemList
  #--------------------------------------------------------------------------
  # * Include in Item List?
  #--------------------------------------------------------------------------
  alias tri_dw2hfix_include? include?
  def include?(item)
    # If the actor dual wields AND item is a weapon
    if @actor.dual_wield? && item.is_a?(RPG::Weapon)
      # Don't show it if we're equipping the off-hand and the actor already has
      # a two-handed weapon in the main hand.
      if @actor.equips[0] != nil && @actor.equips[0].two_handed? && @slot_id == 1
        return false
      end
      # Also don't show it if we're equipping any slot but the first and the
      # item is two-handed (so we can't equip 2H items in the off-hand)
      return false if item.two_handed? && @slot_id != 0
    end
    tri_dw2hfix_include?(item)
  end
end