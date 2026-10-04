=begin
#==============================================================================
 ** Effect: Vampiric Weapon
 Author: Hime
 Date: Nov 9, 2012
------------------------------------------------------------------------------
 ** Change log
 Nov 9, 2012
   - converted amount drained to an int
 Oct 8, 2012
   - initial release
------------------------------------------------------------------------------   
 ** Terms of Use
 * Free to use in non-commercial projects
 * Contact me for commercial use
 * No real support. The script is provided as-is
 * Will do bug fixes, but no compatibility patches
 * Features may be requested but no guarantees, especially if it is non-trivial
 * Preserve this header
------------------------------------------------------------------------------
 Adds a "vampiric weapon" effect to your state.
 When a battler has this effect, all attacks will drain HP equal to the damage,
 offset by some amount.
 
 Tag your state with
    <eff: vampiric_weapon x>
    
 Where x is a percentage of the damage inflicted, as a float
 eg: 0.5 means you will absorb 50% of damage dealt as HP.
#==============================================================================
=end
$imported = {} if $imported.nil?
$imported["Effect_VampiricWeapon"] = true
#==============================================================================
# ** Rest of the script
#==============================================================================
module Effect
  module Vampiric_Weapon
    Effect_Manager.register_effect(:vampiric_weapon)
  end
end

class Game_Battler < Game_BattlerBase
  
  def effect_vampiric_weapon(user, obj, effect)
    return if user == self
    amount = [@result.hp_damage, @result.old_hp].min
    amount = (amount * (eval(effect.value1[0]) rescue 1)).to_i
    user.hp = [user.hp + amount, user.mhp].min
    self.hp = [self.hp - amount, 0].max
    
    @result.effect_results.push("%s drained %d HP from %s" %[user.name, amount, self.name])
    @result.success = true
  end
  
  alias :actor_effect_vampiric_weapon_attack :effect_vampiric_weapon
  alias :weapon_effect_vampiric_weapon_attack :effect_vampiric_weapon
  alias :state_effect_vampiric_weapon_attack :effect_vampiric_weapon
end