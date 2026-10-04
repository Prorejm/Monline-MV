=begin
===============================================================================
 Message Visibility by efeberk
 Version: RGSS3
===============================================================================
 This script will allow to player sets message window visible or unvisible with 
 a key.
 
 Example : Press CTRL to hide message window and repress CTRL to show message 
 window.
--------------------------------------------------------------------------------
=end

module EFE
  
  KEY = :X

end

class Window_Message < Window_Base
  
  alias efeberk_window_message_update update
  def update
    efeberk_window_message_update
    if Input.trigger?(EFE::KEY)
      self.visible = !self.visible
    end
  end
  
end