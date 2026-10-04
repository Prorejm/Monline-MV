#==============================================================================
#
# ▼ Reballic Convenience Scripts - HP/MP Percent Operations
# -- Last Updated: 2012.04.11
# -- Level: Easy
#
#==============================================================================
 
#==============================================================================
# ▼ Updates
# =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
# 2012.04.11 - Added separate functions for calculating remaining HP and MP
#              percentages so you don't have to calculate both to get one.
#            - Added an additional function to calculate a specific percentage
#              of an actor's Max HP or MP.
# 2011.12.20 - Converted script to RGSS3
#
#==============================================================================
# ▼ Introduction
# =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
# This script allows you to calculate the percentage of an actor's remaining HP
# or MP easily, circumventing the need for numerous variable operations. You
# can also calculate the exact percentage of an actor's HP or MP. This script is
# intended for use in simplifying HP/MP calculations when dealing with meeting
# certain conditions for triggering events or other miscellaneous calculations.
#
#==============================================================================
# ▼ Instructions
# =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
# To install this script, open up your script editor and copy/paste this script
# to an open slot below ▼ Materials/素材 but above ▼ Main. Remember to save.
#
# -----------------------------------------------------------------------------
# Script Calls - These commands are used with the Script Call event command.
# -----------------------------------------------------------------------------
# get_hp_percent(n)
# This call will determine the percentage of actor n's remaining HP. Using a
# value of -1 will determine the percentage of the active party's remaining HP.
#
# get_mp_percent(n)
# This call will determine the percentage of actor n's remaining MP. Using a
# value of -1 will determine the percentage of the active party's remaining MP.
#
# get_all_percent(n)
# This call performs the combined function of the two above calls. It calculates
# the percentage of the actor (or party)'s remaining HP and MP in one call.
#
# calculate_hp_percent(n, x)
# This call will determine what x% of actor n's MaxHP is. Easier than performing
# a string of variable operations to achieve the same effect.
#
# calculate_mp_percent(n, x)
# This call will determine what x% of actor n's MaxMP is. Easier than performing
# a string of variable operations to achieve the same effect.
#
#==============================================================================
# ▼ Compatibility
# =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
# This script was converted from a script written in RGSS2 for RPG Maker VX by
# a novice scripter. Perfect compatibility is not guaranteed.
#
#==============================================================================
 
module RCS
  module Percent
    #=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    # - HP and MP Calculation Variables -
    #=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    # These variables are used in the HP and MP percentage calculations. To note,
    # PERCENT is used for the actual percentage, CURRENT is used for the current
    # value of the respective stat, MAXIMUM is for the max of the respective stat,
    # and PERCALC is used for calculating specific percentages of an actor's max
    # HP or MP. You can set and order them however you like, but be sure that
    # the variables you set don't conflict with ones used by other scripts.
    #
    # It should be noted that the values in the CURRENT and MAXIMUM variables
    # are not actually used in calculations. They are gathered purely for your
    # convenience, should you need those values and don't want to have to set
    # up a variable operation yourself just to retrieve those values.
    #
    # Set any variables you don't want to use to 0.
    #=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
 
    VAR_HPPERCENT = 10
    VAR_HPCURRENT = 0
    VAR_HPMAXIMUM = 0
    VAR_MPPERCENT = 11
    VAR_MPCURRENT = 0
    VAR_MPMAXIMUM = 0
    VAR_HPPERCALC = 0
    VAR_MPPERCALC = 0
  end #Percent
end #RCS
 
#==============================================================================
# ▼ Support will not be given for editing anything past this line. Not like I
# could, but just so you know, I am not liable for any damage you cause.
#==============================================================================
 
#==============================================================================
# ■ Game_Interpreter
#==============================================================================
 
class Game_Interpreter
 
  #--------------------------------------------------------------------------
  # new method: get_hp_percent
  #--------------------------------------------------------------------------
  def get_hp_percent(actor_id)
    id = actor_id
    actor = $game_actors[actor_id]
    $game_variables[RCS::Percent::VAR_HPCURRENT] = $game_actors[id].hp
    $game_variables[RCS::Percent::VAR_HPMAXIMUM] = $game_actors[id].mhp
    @percent = ((actor.hp.to_f / actor.mhp.to_f) * 100).to_i
    $game_variables[RCS::Percent::VAR_HPPERCENT] = @percent
  end
 
  #--------------------------------------------------------------------------
  # new method: get_mp_percent
  #--------------------------------------------------------------------------
  def get_mp_percent(actor_id)
    id = actor_id
    actor = $game_actors[actor_id]
    $game_variables[RCS::Percent::VAR_MPCURRENT] = $game_actors[id].mp
    $game_variables[RCS::Percent::VAR_MPMAXIMUM] = $game_actors[id].mmp
    @percent = ((actor.mp.to_f / actor.mmp.to_f) * 100).to_i
    $game_variables[RCS::Percent::VAR_MPPERCENT] = @percent
  end
 
  #--------------------------------------------------------------------------
  # new method: get_all_percent
  #--------------------------------------------------------------------------
  def get_all_percent(actor_id)
    id = actor_id
    if id == -1 then
      @total_hp = 0
      @total_maxhp = 0
      @total_mp = 0
      @total_maxmp = 0
      for actor in $game_party.members
        @total_hp += actor.hp
        @total_maxhp += actor.mhp
        @total_mp += actor.mp
        @total_maxmp += actor.mmp
      end
      $game_variables[RCS::Percent::VAR_HPCURRENT] = @total_hp
      $game_variables[RCS::Percent::VAR_HPMAXIMUM] = @total_maxhp
      @percent = ((@total_hp.to_f / @total_maxhp.to_f) * 100).to_i
      $game_variables[RCS::Percent::VAR_HPPERCENT] = @percent
      $game_variables[RCS::Percent::VAR_MPCURRENT] = @total_mp
      $game_variables[RCS::Percent::VAR_MPMAXIMUM] = @total_maxmp
      @percent = ((@total_mp.to_f / @total_maxmp.to_f) * 100).to_i
      $game_variables[RCS::Percent::VAR_MPPERCENT] = @percent
    else
      actor = $game_actors[actor_id]
      $game_variables[RCS::Percent::VAR_HPCURRENT] = $game_actors[id].hp
      $game_variables[RCS::Percent::VAR_HPMAXIMUM] = $game_actors[id].mhp
      @percent = ((actor.hp.to_f / actor.mhp.to_f) * 100).to_i
      $game_variables[RCS::Percent::VAR_HPPERCENT] = @percent
      $game_variables[RCS::Percent::VAR_MPCURRENT] = $game_actors[id].mp
      $game_variables[RCS::Percent::VAR_MPMAXIMUM] = $game_actors[id].mmp
      @percent = ((actor.mp.to_f / actor.mmp.to_f) * 100).to_i
      $game_variables[RCS::Percent::VAR_MPPERCENT] = @percent
    end
  end
 
  #--------------------------------------------------------------------------
  # new method: calculate_hp_percent
  #--------------------------------------------------------------------------
  def calculate_hp_percent(actor_id, percent)
    id = actor_id
    @calcresult = ($game_actors[id].mhp.to_f * (percent.to_f / 100)).to_i
    $game_variables[RCS::Percent::VAR_HPPERCALC] = @calcresult
  end
 
  #--------------------------------------------------------------------------
  # new method: get_mp_percent
  #--------------------------------------------------------------------------
  def calculate_mp_percent(actor_id, percent)
    id = actor_id
    @calcresult = ($game_actors[id].mmp.to_f * (percent.to_f / 100)).to_i
    $game_variables[RCS::Percent::VAR_MPPERCALC] = @calcresult
  end
end # Game_Interpreter
 
#==============================================================================
# ■ Game_Actor
#==============================================================================
 
class Game_Actor
  #--------------------------------------------------------------------------
  # alias method: setup
  #--------------------------------------------------------------------------
  alias game_actor_setup_hpmpops setup
  def setup(actor_id)
    game_actor_setup_hpmpops(actor_id)
    @percent = 0
    @calcresult = 0
    @total_hp = 0
    @total_maxhp = 0
    @total_mp = 0
    @total_maxmp = 0
  end
end # Game_Actor
 
#==============================================================================
#
# ▼ End of File
#
#==============================================================================