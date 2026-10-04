
#==============================================================================
#   Simple Self Switches
#   Author: Nicke
#   Created: 16/06/2011
#   Edited: 03/01/2012
#   Version: 1.0a
#==============================================================================
# Instructions
# -----------------------------------------------------------------------------
# To install this script, open up your script editor and copy/paste this script
# to an open slot below â–¼ Materials but above â–¼ Main. Remember to save.
#
# Use the call script to use this script.
#
# setSelfSwitch (map, id, A-D, true/false)
# isSelfSwitch?(map, id, A-D, true)
# setAllSelf(map, id, true/false)
#
# Note: You can use @map_id if you change the self switches on the same map.
#
# Example 1: setSelfSwitch(@map_id, 1, "A", true)
# This will change the Self Switch "A" of event ID 1 to true on current map.
# Example 2: setSelfSwitch(2, 1, "A", false)
# This will change the Self Switch "A" of event ID 1 to false on map id 2.
#
# You can also check if Self Switch is true/false.
# Example: isSelfSwitch?(2, 1, "A") # Is event_id 1 true on map id 2?
# Example: !isSelfSwitch?(@map_id, 1, "A") # Is event_id 1 false on current map?
# Put this in a Conditional Branch.
#
# Last but not least you can turn all Self Switches to true/false.
# Example 1: setAllSelf(2, 1, true) Set all of event id 1 true on map id 2.
# Example 2: setAllSelf(@map_id, 1, true) Set all of event id 1 to true on current map.
#
# *** Only for RPG Maker VX Ace. ***
#==============================================================================
($imported ||= {})["NICKE-EVENT-SELFSWITCHES"] = true
# *** Don't edit below unless you know what you are doing. ***
#==============================================================================#
# ** Game_Interpreter
#==============================================================================#
class Game_Interpreter

 # // Set SelfSwitch to true/false.
 def setSelfSwitch(map, eID, selfSwitch, trueFalse)
switch = [map, eID, selfSwitch]
$game_self_switches[switch] = trueFalse
 end

 # // Is SelfSwitch true/false?
 def isSelfSwitch?(map, eID, selfSwitch)
switch = [map, eID, selfSwitch]
$game_self_switches[switch]
 end

 # // Set all SelfSwitches to true/false.
 def setAllSelf(map, eID, trueFalse)
switches = ["A","B","C","D"]
for i in switches
  setSelfSwitch(map, eID, i, trueFalse)
end
 end

end # END OF FILE

#=*==========================================================================*=#
# ** END OF FILE
#=*==========================================================================*=#