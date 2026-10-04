=begin
#==============================================================================
 ** Effect: Vice Versa
 Require: Hime - Effect Manager
Modified version of Thorn Mail effect.
Thorn Mail Author: Hime
------------------------------------------------------------------------------   
 ** Terms of Use (from Hime Thorn Mail)
 * Free to use in non-commercial projects
 * Contact me for commercial use
 * No real support. The script is provided as-is
 * Will do bug fixes, but no compatibility patches
 * Features may be requested but no guarantees, especially if it is non-trivial
 * Preserve this header
------------------------------------------------------------------------------
------------------------------------------------------------------------------   
 Tag your state with:
    <eff: vice_versa x>
    (ex. <eff: vice_versa 0.5>) [Attacker receives 50% of damage dealt.]
    
 Where x is the amount of damage they will receive.
#==============================================================================
=end
$imported = {} if $imported.nil?
$imported["Effect_ViceVersa"] = true
#==============================================================================
# ** Rest of the script
#==============================================================================
module Effect
  module Vice_Versa
    Effect_Manager.register_effect(:vice_versa)
  end
end

class Game_Battler < Game_BattlerBase
 
  def effect_vice_versa(user, item, effect)
    return if user == self
    return if @result.hp_damage <= 0
    #damage = eval(hp.damage).to_i
    
    mod = eval(effect.value1[0]) #rescue 1
      #damage = (@result.hp_damage * mod).to_i
    hp_damage = (@result.hp_damage * mod).to_i
    #damage = @result.hp_damage
    #user.hp -= damage
    #user.hp -= @result.hp_damage
    user.hp -= hp_damage
    user.perform_collapse_effect if user.dead?
    @result.effect_results.push("%s takes %s damage!" %[user.name, hp_damage])
    @result.success = true
    if $imported["YEA-BattleEngine"]
      if mod > 0
        user.create_popup(hp_damage, "HP_DMG")
      elsif mod < 0
       user.create_popup(hp_damage, "HP_HEAL")
      end
    end
  end
 
  alias :state_effect_vice_versa_guard :effect_vice_versa
  alias :enemy_effect_vice_versa_guard :effect_vice_versa
  alias :actor_effect_vice_versa_guard :effect_vice_versa
end

class Game_Actor < Game_Battler
 
  alias :armor_effect_vice_versa_guard :effect_vice_versa
  alias :weapon_effect_vice_versa_guard :effect_vice_versa
end