#===============================================================================
# N.A.S.T.Y. Text Pop Over Events
# Nelderson's Awesome Scripts To You
#
# By: Nelderson
# Last Updated: 3/18/20112
#
# Version 1.0 - 3/17/2012
#
#===============================================================================
#
# Update History:
# - Version 1.0 - Initial release, 1st Resource Script for rpgmakervxace.net
#===============================================================================
# *Features:
# - This script creates text above an event or the player on a map
#
# *Initial Setup
# - This script has a small setup section to define a few Defaults when
# text is first put up above an event's head:
#
# DEF_TEXT_COLOR - Is the default text color when not defined in the
# script call. When you pick a color you have to use
# the form:
#
# Color.new(r,g,b,a) - Where r = red, g = green,
# b = blue, and a = alpha
#
# DEF_TEXT_SIZE - This is the default text font size, pretty easy here.
#
# DEF_TEXT_FONT - This is the name of the default font that'll be used
# for text pops that don't specify one in the script call
#
# *Script Call:
#
# - nel_textpop(:attribute => value,
# :attribute2 => value,
# :attribute3: => value,
# )
#
# ** Where :attributes can be any one of the following:
#
# :text => Values will be in "quotes", and displays over event
# (Defaults to "" when not defined)
#
# :event_id => The Event ID that will display text.
# 0 = Current Event ID, -1 = Player,
# -2 1stFollower, -3 2ndFollower, -4 3rdFollower
# (Defaults to 0 when not defined)
#
# :time => This is the time that the text will last in FRAMES.
# 60 FRAMES = 1 second,
# *Note: Set :time => nil for the text to last forever*
# (Defaults to nil when not defined)
#
# :font => This is the name of the font you want for the text.
# Values with be in "quotes"
# (Defaults to DEF_TEXT_FONT when not defined)
#
# :size => This changes the font size on the text displayed
# (Defaults to DEF_TEXT_SIZE when not defined)
#
# :color => This changes the color of the text displayed
# Values need to be => Color.new(r,g,b,a)
# (Defaults to DEF_TEXT_COLOR when not defined)
#
# :bold => This makes the displayed text bold
# Values need to be => true or false
# (Defaults to false when not defined)
#
# :italic => This makes the displayed text italic
# Values need to be => true or false
# (Defaults to false when not defined)
#
# *Instructions
# -You can place the script call nel_textpop in any event
#
# -You don't have to define every attribute, they will automatically
# go to the defaults to make things easier.
#
# *Sample Call
#
# nel_textpop(
# :text => "I hate you!",
# :event_id => -1,
# :bold => true,
# :italic => true,
# :time => 120,
# :font => "Vrinda",
# :size => 64,
# :color => Color.new(220,20,60),
# )
#
#===============================================================================
# Credits:
# -Nelderson, tomoaky, and IceDragon
#===============================================================================
# Based off: RGSS2_namepop Ver0.02
# tomoaky (http://hikimoki.sakura.ne.jp/)
#===============================================================================

module NEL
#Default text pop font
DEF_TEXT_FONT = "Myriad"

#Default text pop font size
DEF_TEXT_SIZE = 16

#Default text pop color
DEF_TEXT_COLOR = Color.new(255,255,255,255)# <== White

end #<=== Don't Touch

#========#======================#====#================================#========#
#--------# #----# DO NOT EDIT PAST THIS POINT!!! #--------#
#--------# End of Customization #----# Editing will cause death by #--------#
#--------# #----# Zetu Stabbing your heart </3 #--------#
#========#======================#====#================================#========#

# // 02/03/2012 [
#Collects the hash keys in order, and then passes the values
class Hash
# // IceDragon <=== *The Ultimate in Awesome OTL
def get_values(*args)
args.collect {|a|self[a]}
end
end
# // 02/03/2012 ]

class Game_Interpreter
include NEL
#IceDragon helped make this script call easier with awesomeness...Thanks Icy!
def nel_textpop(*args)
if(args[0].is_a?(Hash))
text, ev_id, time, size, color, font, bold, ital = args[0].get_values(:text,:event_id,:time,:size,:color,:font,:bold,:italic)
else
text, ev_id, time, size, color, font, bold, ital = *args
end
char = nel_get_character(ev_id || 0)
return unless(char)
char.namepop_size = size || DEF_TEXT_SIZE
char.namepop_color= color || DEF_TEXT_COLOR
char.namepop_time = time || nil
char.namepop = text || ""
char.namepop_font = font || DEF_TEXT_FONT
char.namepop_bold = !!bold # // Convert to Bool
char.namepop_ital = !!ital
char.textpop_flag = true #Forces refresh
end

#--------------------------------------------------------------------------
# *New Method: nel_get_character
#
# Instead of original get_character, this include Followers in the argument
#--------------------------------------------------------------------------
def nel_get_character(param)

if $game_party.in_battle
nil
elsif param < 0
case param
when -1; return $game_player
else; return $game_player.followers[(param + 2) * (-1)]
end
else
events = same_map? ? $game_map.events : {}
events[param > 0 ? param : @event_id]
end
end
#--------------------------------------------------------------------------
end
#==============================================================================
# ¡ Game_Character
#==============================================================================
class Game_Character
#--------------------------------------------------------------------------
# œ œöŠJƒCƒ“ƒXƒ^ƒ“ƒX•Ï”
#--------------------------------------------------------------------------
attr_accessor :namepop
attr_accessor :namepop_size
attr_accessor :namepop_color
attr_accessor :namepop_time
attr_accessor :namepop_font
attr_accessor :namepop_bold
attr_accessor :namepop_ital
attr_accessor :textpop_flag #Instant update if script call is used

#--------------------------------------------------------------------------
alias nel_font_type_init initialize
def initialize
@namepop_font = NEL::DEF_TEXT_FONT
@namepop_bold = false
@namepop_ital = false
@textpop_flag = false
nel_font_type_init
end
end
#==============================================================================
# ¡ Sprite_Character
#==============================================================================
class Sprite_Character < Sprite_Base
alias nel_textx_pop_initi initialize
def initialize(*args)
@timer = 0
nel_textx_pop_initi(*args)
end
#--------------------------------------------------------------------------
# œ ‰ð•ú
#--------------------------------------------------------------------------
alias tnpop_sprite_character_dispose dispose
def dispose
dispose_namepop
tnpop_sprite_character_dispose
end
#--------------------------------------------------------------------------
# œ ƒtƒœ[ƒ€XV
#--------------------------------------------------------------------------
alias tnpop_sprite_character_update update
def update
tnpop_sprite_character_update #Original Update
if @timer > 0 && @character.textpop_flag == false#Skip when script called
@timer -= 1
update_text_pos
if @timer <= 0
@namepop_sprite.visible = false
@namepop_sprite.opacity = 255 #Reset opacity just in case
@namepop_sprite = nil
@character.namepop = nil
@namepop = nil
@tmer_rat = nil #Reset ratio, just to avoid issues
elsif @timer < 60
#Fade out text gradually within the last 60 frames
@tmer_rat ||= 255/@timer
@namepop_sprite.opacity -= @tmer_rat
end
else
update_namepop
if @character.textpop_flag == true #If script call
@namepop = @character.namepop
start_namepop
end
end
end

def update_text_pos
@namepop_sprite.x = x
@namepop_sprite.y = y - height
@namepop_sprite.z = z + 200
end

#--------------------------------------------------------------------------
# › namepop‚ÌŠJŽn
#--------------------------------------------------------------------------
def start_namepop
dispose_namepop
return if @namepop == "none" or @namepop == nil
@namepop_sprite = ::Sprite.new(viewport)
b_width = @namepop.size * 8
b_height = @character.namepop_size + 20
@namepop_sprite.ox = 80 + (b_width/2)
@namepop_sprite.oy = 16 + (b_height/2) #16
@namepop_sprite.bitmap = Bitmap.new(b_width+160, b_height)
###Change Font, Font Size, Color, and Time based off Character values##
@namepop_sprite.bitmap.font.color = @character.namepop_color
@namepop_sprite.bitmap.font.size = @character.namepop_size
@namepop_sprite.bitmap.font.name = [@character.namepop_font]
@namepop_sprite.bitmap.font.bold = @character.namepop_bold
@namepop_sprite.bitmap.font.italic = @character.namepop_ital
@namepop_sprite.bitmap.draw_text(0, 0, b_width+160, b_height, @namepop, 1)
@namepop_time = @character.namepop_time
update_namepop(@namepop_time) #Pass a timer variable
@character.textpop_flag = false
end
#--------------------------------------------------------------------------
# › namepop‚ÌXV
#--------------------------------------------------------------------------
def update_namepop(time = nil) #Add a timer variable
if @namepop_sprite != nil
@namepop_sprite.x = x
@namepop_sprite.y = y - height
@namepop_sprite.z = z + 200
if time != nil
@timer = time
@namepop_time = 0
end
end
end
#--------------------------------------------------------------------------
# › namepop‚Ì‰ð•ú
#--------------------------------------------------------------------------
def dispose_namepop
if @namepop_sprite != nil
@namepop_sprite.bitmap.dispose
@namepop_sprite.dispose
@namepop_sprite = nil
end
end
end