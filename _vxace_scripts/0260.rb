=begin
#===============================================================================
 Title: Message Face Control
 Author: Hime
 Date: Dec 25, 2014
 URL: http://himeworks.com/2014/12/message-face-control/
--------------------------------------------------------------------------------
 ** Change log
 Dec 25, 2014
   - refactored
 Dec 22, 2014
   - Initial release
--------------------------------------------------------------------------------   
 ** Terms of Use
 * Free to use in non-commercial projects
 * Contact me for commercial use
 * No real support. The script is provided as-is
 * Will do bug fixes, but no compatibility patches
 * Features may be requested but no guarantees, especially if it is non-trivial
 * Credits to Hime Works in your project
 * Preserve this header
--------------------------------------------------------------------------------
 ** Description
 
 This script provides a message code that allows you to change the face that
 will be displayed in the message box. This allows you to display different
 faces in the middle of a message.
 
 The message code is customizable so you can choose what code you want to use
 in case of conflicts with other scripts.
 
 This script can be used in conjunction with other scripts that treat
 certain face names in a special way. For example, you can use
 Placeholder Graphics to draw faces based on certain actors or party members.
 
--------------------------------------------------------------------------------
 ** Installation
 
 In the script editor, place this script below Materials and above Main

--------------------------------------------------------------------------------
 ** Usage
 
 The message code takes a name, which is the name of the face image to use.
 It also takes an index, which is the index of the face on the image.
 
 In the configuration, you choose the code and delimiter that you want to use
 for the message code. The delimiter is what separates the name from the index.
   
 By default, the code is MF and the delimiter is the comma (,).
 Use the message code
 
   \MF[name,index]
   
 To change the face that is shown in the message box.
 
--------------------------------------------------------------------------------
 ** Examples
 
 To change the face to the first face in the face sheet, use the code
 
 \MF[actor1,1]
 
 To change to the second face of the same sheet, use
 
 \MF[actor1,2] 


#===============================================================================
=end
$imported = {} if $imported.nil?
$imported[:TH_MessageFaceControl] = true
TEXT_X = 0           # Offset text when displaying busts above the message
                       # window. The script automatically offsets the text x 
                       # by the bust image width IF the BUST_Z is 0 or more.
#===============================================================================
# ** Configuration
#===============================================================================
module TH
  module Message_Face_Control
    Code = "MF"
    Delim = ","
    
    Regex = /\[(.*?)\s*#{Delim}\s*(\d+?)\]/i
  end
end

class Window_Message < Window_Base
  
  alias :th_message_face_control_process_escape_character :process_escape_character
  def process_escape_character(code, text, pos)    
    if code.upcase == TH::Message_Face_Control::Code      
      process_face_control_code(code, text, pos)
    else
      th_message_face_control_process_escape_character(code, text, pos)
    end    
  end
  
  def process_face_control_code(code, text, pos)
    data = text.slice!(/\[.*?\]/i)
    if data =~ TH::Message_Face_Control::Regex
      name = $1
      index = $2.to_i - 1
      process_face_control(name, index)
    end    
  end
  
  def process_face_control(name, index)    
    contents.clear_rect(Rect.new(0, 0, 96, 96))
    draw_face(name, index, 0, 0)
  end
end