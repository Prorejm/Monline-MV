#------------------------------------------------------------------------------#
#  Galv's Simple Debug
#------------------------------------------------------------------------------#
#  For: RPGMAKER VX ACE
#  Version 1.1
#  Requested by HotfireLegend
#------------------------------------------------------------------------------#
#  2013-05-08 - Version 1.1 - fixed BGS crash error
#  2013-03-09 - Version 1.0 - release
#------------------------------------------------------------------------------#
#  A simple script that can print details to the console and/or display window
#  popups to inform you what sound/music has begun playing, what switches or
#  self switches are being changed or what variables get changed during play.
#  It will only show these notifications during test play to help debug.
#
#  To open the console, in RPGmaker editor, go to the "Game" menu and click
#  "Show Console".
#
#  Settings to turn which notifications you want or don't want on and off are
#  further down.
#------------------------------------------------------------------------------#
 
#------------------------------------------------------------------------------#
#  Don't touch - Setup Options further down
#------------------------------------------------------------------------------#
if $TEST 
($imported ||= {})["Galv_Debugger"] = true
module GalvT
  POPUPS = [ # don't touch
#------------------------------------------------------------------------------#
 
 
#------------------------------------------------------------------------------#  
#  SETUP OPTIONS
#------------------------------------------------------------------------------#
#  Set true or false to pop up a window when the below are activated/changed
#  The info will be displayed in the console for all regardless.
#  Set to nil if you don't want to display them in the console either.
#-------------------------------------------------------------------------------  
 
    false,   # BGM
    false,   # BGS
    false,   # SE
    false,   # ME
    false,   # Switch
    false,   # Self Switch
    false,   # Variables
 
#------------------------------------------------------------------------------#  
#  END SETUP OPTIONS
#------------------------------------------------------------------------------#
 
    ] # don't touch
     
    def self.tmsg(string,type)
      return if GalvT::POPUPS[type].nil?
      msgbox(string) if GalvT::POPUPS[type]
      p string
    end
end
 
class RPG::BGM < RPG::AudioFile
  alias galv_bgm_test_play play
  def play(pos = 0)
    if @name != ""
      GalvT::tmsg("BGM: " + @name,0)
    end
    galv_bgm_test_play(pos = 0)
  end
end
 
class RPG::BGS < RPG::AudioFile
  alias galv_bgs_test_play play
  def play(pos = 0)
    galv_bgs_test_play
    if !@name.empty?
      GalvT::tmsg("BGS: " + @name,1)
    end
  end
end
 
class RPG::SE < RPG::AudioFile
  alias galv_se_test_play play
  def play
    galv_se_test_play
    if !@name.empty?
      GalvT::tmsg("SE: " + @name,2)
    end
  end
end
 
class RPG::ME < RPG::AudioFile
  alias galv_me_test_play play
  def play
    galv_me_test_play
    if !@name.empty?
      GalvT::tmsg("ME: " + @name,3)
    end
  end
end
 
class Game_Switches
  alias galv_switches_test_sw []=
  def []=(switch_id, value)
    galv_switches_test_sw(switch_id, value)
    txt = value ? "ON" : "OFF"
    GalvT::tmsg("Switch " + switch_id.to_s + " is " + txt,4)
  end
end
 
class Game_SelfSwitches
  alias galv_self_switches_test_sw []=
  def []=(key, value)
    galv_self_switches_test_sw(key, value)
    txt = value ? "ON" : "OFF"
    GalvT::tmsg("Event " + key[1].to_s + "'s self switch '" + key[2] + "' is " +
      txt,5)
  end
end
 
class Game_Variables
  alias galv_variables_test_v []=
  def []=(variable_id, value)
    galv_variables_test_v(variable_id, value)
    GalvT::tmsg("Variable " + variable_id.to_s + " = " + value.to_s,6)
  end
end
end