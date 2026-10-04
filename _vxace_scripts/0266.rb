#:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=
#  ▼ Equipment performance rating enhancement
#  Author: Trihan
#  Version 1
#  Release date: 20/04/2015
#
#  Thanks for Sixth for pointing out an issue with sparam weights.
#
#:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=

#-------------------------------------------------------------------------------
#  ▼ UPDATES
#-------------------------------------------------------------------------------
# # 21/04/2015. Edited the default config to give negative weights to some
# # sparams so they're considered appropriately for their effect.
# # 20/04/2015. First release
#-------------------------------------------------------------------------------
#  ▼ TERMS OF USAGE
#-------------------------------------------------------------------------------
# # You are free to adapt this work to suit your needs.
# # You can use this work for commercial purposes if you like it.
# # Credit is appreciated.
# #
# # For support:
# # rpgmaker.net
# # rmrk.net
# # rpgmakervxace.net
# # rpgrevolution.com
#-------------------------------------------------------------------------------
#  ▼ INTRODUCTION
#-------------------------------------------------------------------------------
# # The default behaviour of the equipment optimisation method for actors
# # takes nothing but its parameter bonuses into account; this means you
# # could have armour with 18 DEF that will be equipped over one with 17
# # DEF that quadruples your HP and reduces all damage to 0%. This script
# # aims to change that by giving features a weight that will be considered
# # when picking the "optimal" equipment.
#-------------------------------------------------------------------------------
#  ▼ INSTRUCTIONS
#-------------------------------------------------------------------------------
# # Set the weights for each feature in the config however you like. The script
# # will do the rest.
#-------------------------------------------------------------------------------
#  ▼ COMPATIBILITY
#-------------------------------------------------------------------------------
# # List of aliases and overwrites:
# #
# # RPG::Armor
# # performance (alias)
# #
# # RPG::Armor
# # performance (alias)
# #
# # RPG::EquipItem
# # performance_plus (new method)
# # tri_pre_calc_bonus_percentage_with_id (new method)
# # tri_pre_add_bonus_with_id (new method)
# # tri_pre_add_bonus (new method)
# # tri_pre_calc_bonus_percentage_param (new method)
# # tri_pre_calc_bonus_param_with_id (new method)
# # tri_pre_calc_bonus_param (new method)
# # tri_pre_calc_bonus (new method)
# #
# # As far as I'm aware there aren't any other scripts that change the way
# # performance works, so there shouldn't be any compabitility issues.
#-------------------------------------------------------------------------------
$imported = {} if $imported.nil?
$imported['TriPRE'] = true

module TRI_PRE
  # DO NOT EDIT THESE
  temp_system_data = load_data("Data/System.rvdata2")
  temp_state_data = load_data("Data/States.rvdata2")
  temp_skill_data = load_data("Data/Skills.rvdata2")
 
  CONFIG = {
  # ----------------------------------------------------------------------------
  # EDITABLE REGION BEGINS HERE
  # ----------------------------------------------------------------------------
  # :reverse_negatives - A flag which determines whether negative values will
  # reduce an item's performance rating. For example, armour which makes you
  # take an additional 5% fire damage would reduce the rating instead of adding
  # to it.
  # ----------------------------------------------------------------------------
    :reverse_negatives    => true,
  # ----------------------------------------------------------------------------
  # :element_rate_weight - Determines how many points are added to an item's
  # performance rating for each percent of elemental reduction. The script
  # will automatically populate the array with the value in brackets for each
  # defined element. See below for how to override individual elements.
  # ----------------------------------------------------------------------------
    :element_rate_weight  => [1] * temp_system_data.elements.size,
  # ----------------------------------------------------------------------------
  # :debuff_rate_weight - Determines how many points are added to an item's
  # performance rating for each percent of debuff protection. The script
  # will automatically populate the array with the value in brackets for each
  # debuff parameter. See below for how to override individual elements.
  # The indexes are as follows:
  # [MAX HP, MAX MP, ATK, DEF, MAT, MDF, AGI, LUK]
  # ----------------------------------------------------------------------------
    :debuff_rate_weight  => [1, 1, 1, 1, 1, 1, 1, 1],
  # ----------------------------------------------------------------------------
  # :state_rate_weight - Determines how many points are added to an item's
  # performance rating for each percent of state protection. The script
  # will automatically populate the array with the value in brackets for each
  # defined state. See below for how to override individual elements.
  # ----------------------------------------------------------------------------
    :state_rate_weight  => [1] * temp_state_data.size,
  # ----------------------------------------------------------------------------
  # :state_resist_weight - Determines how many points are added to an item's
  # performance rating for each state resisted. The script will automatically
  # populate the array with the value in brackets for each defined state. See
  # below for how to override individual elements.
  # ----------------------------------------------------------------------------
    :state_resist_weight  => [10] * temp_state_data.size,
  # ----------------------------------------------------------------------------
  # :param_weight - Determines how many points are added to an item's
  # performance rating for each bonus parameter point. The script will
  # automatically populate the array with the value in brackets for each
  # parameter. See below for how to override individual elements.
  # The indexes are as follows:
  # [MAX HP, MAX MP, ATK, DEF, MAT, MDF, AGI, LUK]
  # ----------------------------------------------------------------------------
    :param_weight  => [1, 1, 1, 1, 1, 1, 1, 1],
  # ----------------------------------------------------------------------------
  # :xparam_weight - Determines how many points are added to an item's
  # performance rating for each bonus ex-parameter point. The script will
  # automatically populate the array with the value in brackets for each
  # ex-parameter. See below for how to override individual elements.
  # The indexes are as follows:
  # [HIT, EVA, CRI, CEV, MEV, MRF, CNT, HRG, MRG, TRG]
  # ----------------------------------------------------------------------------
    :xparam_weight  => [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  # ----------------------------------------------------------------------------
  # :sparam_weight - Determines how many points are added to an item's
  # performance rating for each bonus sp-parameter point. The script will
  # automatically populate the array with the value in brackets for each
  # sp-parameter. See below for how to override individual elements.
  # The indexes are as follows:
  # [TGR, GRD, REC, PHA, MCR, TCR, PDR, MDR, FDR, EXR]
  # NOTE: MCR, PDR, MDR and FDR are given negative weights by default because
  # unlike the others, they are better for the actor the lower they are.
  # ----------------------------------------------------------------------------
    :sparam_weight  => [-1, 1, 1, 1, -1, 1, -1, -1, -1, 1],
  # ----------------------------------------------------------------------------
  # :atk_element_weight - Determines how many points are added to an item's
  # performance rating for each additional attack element. The script will
  # automatically populate the array with the value in brackets for each
  # defined element. See below for how to override individual elements.
  # ----------------------------------------------------------------------------
    :atk_element_weight  => [10] * temp_system_data.elements.size,
  # ----------------------------------------------------------------------------
  # :atk_state_weight - Determines how many points are added to an item's
  # performance rating for each percent chance of attack state. The script will
  # automatically populate the array with the value in brackets for each
  # defined state. See below for how to override individual elements.
  # ----------------------------------------------------------------------------
    :atk_state_weight  => [1] * temp_state_data.size,
  # ----------------------------------------------------------------------------
  # :atk_speed_weight - Determines how many points are added to an item's
  # performance rating for each additional point of attack speed.
  # ----------------------------------------------------------------------------
    :atk_speed_weight  => 1,
  # ----------------------------------------------------------------------------
  # :atk_times_weight - Determines how many points are added to an item's
  # performance rating for each additional attack it allows.
  # ----------------------------------------------------------------------------
    :atk_times_weight  => 10,
  # ----------------------------------------------------------------------------
  # :stype_add_weight - Determines how many points are added to an item's
  # performance rating for each additional skill type it unlocks.
  # ----------------------------------------------------------------------------
    :stype_add_weight  => [10] * temp_system_data.skill_types.size,
  # ----------------------------------------------------------------------------
  # :stype_seal_weight - Determines how many points are deducted from an item's
  # performance rating for each skill type it seals.
  # ----------------------------------------------------------------------------
    :stype_seal_weight  => [10] * temp_system_data.skill_types.size,
  # ----------------------------------------------------------------------------
  # :skill_add_weight - Determines how many points are added to an item's
  # performance rating for each additional skill it unlocks.
  # ----------------------------------------------------------------------------
    :skill_add_weight  => [10] * temp_skill_data.size,
  # ----------------------------------------------------------------------------
  # :skill_seal_weight - Determines how many points are deducted from an item's
  # performance rating for each skill it seals.
  # ----------------------------------------------------------------------------
    :skill_seal_weight  => [10] * temp_skill_data.size,
  # ----------------------------------------------------------------------------
  # :equip_wtype_weight - Determines how many points are added to an item's
  # performance rating for each additional weapon type it unlocks.
  # ----------------------------------------------------------------------------
    :equip_wtype_weight  => [10] * temp_system_data.weapon_types.size,
  # ----------------------------------------------------------------------------
  # :equip_atype_weight - Determines how many points are added to an item's
  # performance rating for each additional armour type it unlocks.
  # ----------------------------------------------------------------------------
    :equip_atype_weight  => [10] * temp_system_data.armor_types.size,
  # ----------------------------------------------------------------------------
  # :equip_fix_weight - Determines how many points are deducted from an item's
  # performance rating for each equipment slot it fixes in place.
  # The indexes are as follows:
  # [Weapon, Shield, Head, Body, Accessory]
  # ----------------------------------------------------------------------------
    :equip_fix_weight  => [10, 10, 10, 10, 10],
  # ----------------------------------------------------------------------------
  # :equip_seal_weight - Determines how many points are deducted from an item's
  # performance rating for each equipment slot it seals.
  # The indexes are as follows:
  # [Weapon, Shield, Head, Body, Accessory]
  # ----------------------------------------------------------------------------
    :equip_seal_weight  => [-999, -999, -999, -999, -999],
  # ----------------------------------------------------------------------------
  # :slot_type_weight - Determines how many points are added to an item's
  # performance rating if it allows dual wielding.
  # ----------------------------------------------------------------------------
    :slot_type_weight  => 10,
  # ----------------------------------------------------------------------------
  # :action_plus_weight - Determines how many points are added to an item's
  # performance rating for each percent of additional action chance.
  # ----------------------------------------------------------------------------
    :action_plus_weight  => 1,
  # ----------------------------------------------------------------------------
  # :special_flag_weight - Determines how many points are added to an item's
  # performance rating for each special flag it adds.
  # The indexes are as follows:
  # [Autobattle, Guard, Substitute, Conserve TP]
  # ----------------------------------------------------------------------------
    :special_flag_weight  => [10, 10, 10, 10],
  # ----------------------------------------------------------------------------
  # :party_ability_weight - Determines how many points are added to an item's
  # performance rating for each party ability it adds.
  # The indexes are as follows:
  # [Encounter Half, Encounter None, Cancel Surprise, Raise Preemptive,
  # Gold Double, Drop Item Double]
  # ----------------------------------------------------------------------------
    :party_ability_weight  => [10, 10, -999, 10, 10, 10],
  # ----------------------------------------------------------------------------
  }
  # ----------------------------------------------------------------------------
  # EDITING ANYTHING BEYOND THIS POINT WILL RESULT IN PREMATURE BALDING AND
  # LOSS OF EARNINGS.
  #-----------------------------------------------------------------------------
  FEATURE_ELEMENT_RATE  = 11              # Element Rate
  FEATURE_DEBUFF_RATE   = 12              # Debuff Rate
  FEATURE_STATE_RATE    = 13              # State Rate
  FEATURE_STATE_RESIST  = 14              # State Resist
  FEATURE_PARAM         = 21              # Parameter
  FEATURE_XPARAM        = 22              # Ex-Parameter
  FEATURE_SPARAM        = 23              # Sp-Parameter
  FEATURE_ATK_ELEMENT   = 31              # Atk Element
  FEATURE_ATK_STATE     = 32              # Atk State
  FEATURE_ATK_SPEED     = 33              # Atk Speed
  FEATURE_ATK_TIMES     = 34              # Atk Times+
  FEATURE_STYPE_ADD     = 41              # Add Skill Type
  FEATURE_STYPE_SEAL    = 42              # Disable Skill Type
  FEATURE_SKILL_ADD     = 43              # Add Skill
  FEATURE_SKILL_SEAL    = 44              # Disable Skill
  FEATURE_EQUIP_WTYPE   = 51              # Equip Weapon
  FEATURE_EQUIP_ATYPE   = 52              # Equip Armor
  FEATURE_EQUIP_FIX     = 53              # Lock Equip
  FEATURE_EQUIP_SEAL    = 54              # Seal Equip
  FEATURE_SLOT_TYPE     = 55              # Slot Type
  FEATURE_ACTION_PLUS   = 61              # Action Times+
  FEATURE_SPECIAL_FLAG  = 62              # Special Flag
  FEATURE_PARTY_ABILITY = 64              # Party Ability
end

# You can override specific values in variable-size arrays using the line
# below. Simply copy it for each override you want, fill in the blanks and
# uncomment. For example, if I wanted the fire atk element to give 100 points
# instead of 10, I would write
# TRI_PRE::CONFIG[:atk_element_weight][3] = 100
#
# TRI_PRE::CONFIG[:symbol_name][index] = value

class RPG::Armor < RPG::EquipItem
 
  alias tri_pre_performance performance
  def performance
    tri_pre_performance +
    performance_plus
  end
end

class RPG::Weapon < RPG::EquipItem
 
  alias tri_pre_performance performance
  def performance
    tri_pre_performance +
    performance_plus
  end
end

class RPG::EquipItem < RPG::BaseItem
  include TRI_PRE
 
  def performance_plus
    total = 0
    [
      [:element_rate, FEATURE_ELEMENT_RATE],
      [:debuff_rate, FEATURE_DEBUFF_RATE],
      [:state_rate, FEATURE_STATE_RATE]
    ].each { |symbol, code|
      total += tri_pre_calc_bonus_percentage_with_id(symbol, code)
    }
    [
      [:state_resist, FEATURE_STATE_RESIST],
      [:atk_element, FEATURE_ATK_ELEMENT],
      [:stype_add, FEATURE_STYPE_ADD],
      [:stype_seal, FEATURE_STYPE_SEAL],
      [:skill_add, FEATURE_SKILL_ADD],
      [:skill_seal, FEATURE_SKILL_SEAL],
      [:equip_wtype, FEATURE_EQUIP_WTYPE],
      [:equip_atype, FEATURE_EQUIP_ATYPE],
      [:equip_fix, FEATURE_EQUIP_FIX],
      [:equip_seal, FEATURE_EQUIP_SEAL],
      [:special_flag, FEATURE_SPECIAL_FLAG],
      [:party_ability, FEATURE_PARTY_ABILITY]
    ].each { |symbol, code|
      total += tri_pre_add_bonus_with_id(symbol, code)
    }
    [
      [:slot_type, FEATURE_SLOT_TYPE]
    ].each { |symbol, code|
      total += tri_pre_add_bonus(symbol, code)
    }
    [
      [:param, FEATURE_PARAM],
      [:sparam, FEATURE_SPARAM],
    ].each { |symbol, code|
      total += tri_pre_calc_bonus_percentage_param(symbol, code)
    }
    [
      [:xparam, FEATURE_XPARAM],
      [:atk_state, FEATURE_ATK_STATE]
    ].each { |symbol, code|
      total += tri_pre_calc_bonus_param_with_id(symbol, code)
    }
    [
      [:atk_speed, FEATURE_ATK_SPEED],
      [:atk_times, FEATURE_ATK_TIMES]
    ].each { |symbol, code|
      total += tri_pre_calc_bonus_param(symbol, code)
    }
    [
      [:action_plus, FEATURE_ACTION_PLUS]
    ].each { |symbol, code|
      total += tri_pre_calc_bonus(symbol, code)
    }
    total
  end
 
  def tri_pre_calc_bonus_percentage_with_id(symbol, code)
    matching_features = @features.select { |feature| feature.code == code }
    bonus_performance = matching_features.inject(0) { |total, feature| value = ((100 - feature.value * 100) * CONFIG["#{symbol}_weight".to_sym][feature.data_id]).to_i; value = value.abs if CONFIG[:reverse_negatives] == false; total += value }
  end
 
  def tri_pre_add_bonus_with_id(symbol, code)
    matching_features = @features.select { |feature| feature.code == code }
    bonus_performance = matching_features.inject(0) { |total, feature| total += CONFIG["#{symbol}_weight".to_sym][feature.data_id] }
  end
 
  def tri_pre_add_bonus(symbol, code)
    matching_features = @features.select { |feature| feature.code == code }
    bonus_performance = matching_features.inject(0) { |total, feature| total += CONFIG["#{symbol}_weight".to_sym] }
  end
 
  def tri_pre_calc_bonus_percentage_param(symbol, code)
    matching_features = @features.select { |feature| feature.code == code }
    bonus_performance = matching_features.inject(0) { |total, feature|
    value = ((feature.value * 100 - 100) * CONFIG["#{symbol}_weight".to_sym][feature.data_id]).to_i; value = value.abs if CONFIG[:reverse_negatives] == false; total += value
    }
  end
 
  def tri_pre_calc_bonus_param_with_id(symbol, code)
    matching_features = @features.select { |feature| feature.code == code }
    bonus_performance = matching_features.inject(0) { |total, feature| value = ((feature.value * 100) * CONFIG["#{symbol}_weight".to_sym][feature.data_id]).to_i; value = value.abs if CONFIG[:reverse_negatives] == false; total += value }
  end
 
  def tri_pre_calc_bonus_param(symbol, code)
    matching_features = @features.select { |feature| feature.code == code }
    bonus_performance = matching_features.inject(0) { |total, feature| value = (feature.value * CONFIG["#{symbol}_weight".to_sym]).to_i; value = value.abs if CONFIG[:reverse_negatives] == false; total += value }
  end
 
  def tri_pre_calc_bonus(symbol, code)
    matching_features = @features.select { |feature| feature.code == code }
    bonus_performance = matching_features.inject(0) { |total, feature| value = ((feature.value * 100) * CONFIG["#{symbol}_weight".to_sym]).to_i; value = value.abs if CONFIG[:reverse_negatives] == false; total += value }
  end
end