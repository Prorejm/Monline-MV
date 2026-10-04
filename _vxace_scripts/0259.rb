=begin
#===============================================================================
 Title: Placeholder Graphics
 Author: Hime
 Date: Dec 5, 2014
 URL: http://himeworks.com/2014/12/placeholder-graphics/
--------------------------------------------------------------------------------
 ** Change log 
 Dec 5, 2014
  - Initial release
--------------------------------------------------------------------------------   
 ** Terms of Use
 * Free to use in non-commercial projects
 * Contact me for commercial use
 * No real support. The script is provided as-is
 * Will do bug fixes, but no compatibility patches
 * Features may be requested but no guarantees, especially if it is non-trivial
 * Credits to HimeWorks in your project
 * Preserve this header
--------------------------------------------------------------------------------
 ** Description
 
 This script allows you to use placeholder graphics for your events.
 The appropriate graphics will be chosen automatically by the engine during
 the game.
 
 This script is focused on actors and allows you to create placeholders based
 on an actor's face or the actor's character sprite. Faces are commonly used
 during event dialogue, while character sprites might be used on the map, either
 to reflect a member of the party, or perhaps an actor that is currently NOT a
 member of the party.
 
 Placeholder graphics are useful in situations where the graphics that should
 be displayed are not determined when you designed the game. For example,
 depending on the choices that the player makes, the actor that they end up
 bringing to the final dungeon may be different for each player, and to provide
 a realistic cut-scene, you want to show the correct face in the messages.
 If different actors have different dialogues, then it would be better to 
 simply create separate dialogue trees using conditional branches or otherwise,
 but if the only difference is visual, this is an option.
 
 A placeholder is replaced based on the context defined by the placeholder
 itself. For example, if an event's sprite is based on the actor that is
 currently the leader of the party, then we say the placeholder has a party
 context, and the engine will automatically grab the party leader and use its
 graphic for the event. On the other hand, you could have an event's sprite
 based on whoever is actor 1, whose graphic may have been created using an
 in-game character generator.
 
--------------------------------------------------------------------------------
 ** Installation
 
 In the script editor, place this script below Materials and above Main

--------------------------------------------------------------------------------
 ** Usage
 
 -- Creating Placeholder Images --
 
 A placeholder image is just an image with a special filename. 
 The general format for this filename is as follows
 
   {PATTERN}{CONTEXT}{ID}
   
 The PATTERN is a special sequence of characters that is used to tell the
 engine that this is a placeholder image (as opposed to a regular image).
 
 The CONTEXT tells the engine how it will handle the placeholder. 
 
 The ID is a number and is related to the context
 
 The contents of the image is irrelevant. They are just used as visual
 representation while you are building your game.
 
 -- Using Placeholders --
 
 Once you have created some placeholder images, simply choose that as the image
 for your events or graphics. While it will display your placeholder image in
 the editor, the correct image will be displayed in the game.
 
 -- Placeholder Contexts --
 
 This script supports several different placeholder contexts depending on
 what you need. 
 
 You can see examples in the details below. All examples assume the pattern
 used is % (percent)
 
 1. Actor
 
 These placeholders will be replaced by an actor, based on the actor's ID.
 
 For example, if your filename is called "%actor3", then this image will be
 replaced by actor 3's image.
 
 2. Party placeholders
 
 These placeholders will be replaced by an actor in your party, based on the
 actor's position.
 
 For example, if your filename is called "%party2", then this image will be
 replaced by the actor that is currently in the second position in the party.
 
 3. Variable placeholders
 
 These placeholders will be replaced by an actor, based on the value of the
 specified variable.
 
 For example, if your filename is called "%variable5", then this image will
 be replaced by the actor whose ID is stored in variable 5. The variable can
 be changed at any time, and the placeholder should change accordingly.
 
#===============================================================================
=end
$imported = {} if $imported.nil?
$imported[:TH_PlaceholderGraphics] = true
#===============================================================================
# ** Configuration
#===============================================================================
module TH
  module Placeholder_Graphics
    
    # The placeholder pattern for your filename. You can pick your own if
    # needed.
    Pattern = "%"
    
#===============================================================================
# Rest of Script
#===============================================================================

    Party_Regex    = /.*#{TH::Placeholder_Graphics::Pattern}party(\d+)/i
    Actor_Regex    = /.*#{TH::Placeholder_Graphics::Pattern}actor(\d+)/i
    Variable_Regex = /.*#{TH::Placeholder_Graphics::Pattern}variable(\d+)/i
    
    #---------------------------------------------------------------------------
    # Abstract placeholder graphic object that manages which graphic will be
    # displayed. You should not instantiate this. Instead, use one of the
    # classes that extend this.
    #---------------------------------------------------------------------------
    class Data_PlaceholderGraphic
      
      def initialize(type, id)
        @type = type
        @id = id    
      end
      
      def actor    
        # abstract
      end
      
      def face_name
        actor.face_name
      end
      
      def face_index
        actor.face_index
      end
      
      def character_name
        actor.character_name
      end

      def character_index
        actor.character_index
      end
    end

    class Data_PlaceholderGraphic_Actor < Data_PlaceholderGraphic
      def actor
        return $game_actors[@id]
      end
    end

    class Data_PlaceholderGraphic_Party < Data_PlaceholderGraphic
      def actor
        return $game_party.members[@id]
      end
    end

    class Data_PlaceholderGraphic_Variable < Data_PlaceholderGraphic
      def actor
        return $game_actors[$game_variables[@id]]
      end
    end

    #---------------------------------------------------------------------------
    # Returns the appropriate face for the placeholder name
    #---------------------------------------------------------------------------
    def self.get_data(name)
      case name
      when Party_Regex
        id = $1.to_i - 1
        type = :party
        return Data_PlaceholderGraphic_Party.new(type, id)
      when Actor_Regex
        id = $1.to_i        
        type = :actor
        return Data_PlaceholderGraphic_Actor.new(type, id)
      when Variable_Regex
        id = $1.to_i
        type = :variable
        return Data_PlaceholderGraphic_Variable.new(type, id)
      end            
    end
    
    def self.get_placeholder_data(name)
      TH::Placeholder_Graphics.get_data(name) if name.include?(TH::Placeholder_Graphics::Pattern)
    end
  end
end

#-------------------------------------------------------------------------------
# Let's just assume anyone drawing faces or characters will be checking for
# placeholders as well.
#-------------------------------------------------------------------------------
class Window_Base < Window
  
  alias :th_placeholder_graphics_draw_face :draw_face
  def draw_face(face_name, face_index, x, y, enabled = true)
    data = TH::Placeholder_Graphics.get_placeholder_data(face_name)
    if data
      face_name = data.face_name
#      face_index = data.face_index
    end
    th_placeholder_graphics_draw_face(face_name, face_index, x, y, enabled = true)
  end
 
  alias :th_placeholder_graphics_draw_character :draw_character
  def draw_character(character_name, character_index, x, y)
    data = TH::Placeholder_Graphics.get_placeholder_data(character_name)
    if data
      character_name = data.character_name
      character_index = data.character_index
    end
    th_placeholder_graphics_draw_character(character_name, character_index, x, y)
  end
end

#-------------------------------------------------------------------------------
# Store a placeholder object.
#-------------------------------------------------------------------------------
class Game_Event < Game_Character
  
  alias :th_placeholder_graphics_initialize :initialize
  def initialize(*args)
    clear_placeholder_data
    th_placeholder_graphics_initialize(*args)    
  end
  
  def character_name
    @placeholder_data ? @placeholder_data.character_name : super
  end
  
  def character_index
    @placeholder_data ? @placeholder_data.character_index : super
  end
  
  alias :th_placeholder_graphics_setup_page_settings :setup_page_settings
  def setup_page_settings
    th_placeholder_graphics_setup_page_settings
    setup_placeholder_data
  end
  
  alias :th_placeholder_graphics_clear_page_settings :clear_page_settings
  def clear_page_settings
    th_placeholder_graphics_clear_page_settings
    clear_placeholder_data
  end
  
  def clear_placeholder_data
    @placeholder_data = nil
  end
  
  def setup_placeholder_data
    if @page      
      name = @page.graphic.character_name
      @placeholder_data = TH::Placeholder_Graphics.get_placeholder_data(name)
    end
  end
end