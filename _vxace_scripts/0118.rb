=begin
#===============================================================================
 Title: Symbol Dial System
 Author: Hime
 Date: Mar 31, 2015
 URL: http://himeworks.com/2015/03/symbol-dial-system/
--------------------------------------------------------------------------------
 ** Change log
 Mar 31, 2015
  - Initial Release
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
 
 The symbol dial system allows you to easily set up combination dials with
 any symbols of your choice. You can use numbers, letters, and even characters
 from different languages.
 
 Symbol dials can be used in puzzles where players must figure out the correct
 combination to enter.
 
 As an alternative to the number input which forces you to use all of the digits
 from 0-9, this system allows you to specify which numbers you want to use.
 For example maybe you only want 1-5 to be available for selection.
 
 What can you come up with?
 
--------------------------------------------------------------------------------
 ** Installation
  
 In the script editor, place this script below Materials and above Main

--------------------------------------------------------------------------------
 ** Usage
 
 -- Creating the Dial --

 To create a symbol dial, use script calls to set up the characters that are
 available for each digit:

    set_symbols(digit, symbols)

 The digit is a number that represents which position the digit is in, from
 right to left. 
   
 Symbols is an array of symbols that the player will be able to scroll through.
 For example, a valid script call would be
  
    set_symbols(1, ["A", "B", "C"])
    set_symbols(2, ["1", "2", "3"])
    
 Which will create a dial with two digits: the right-most digit will contain
 three letters, and to the left will be the second digit with three numbers.

 Once you have set up your symbols, you can simply use an "input number"
 command to show the symbol dial. 

 You can have any number of digits, and each digit can have any number of
 symbols. The number of digits that will be displayed depends on how many you
 have set up.  
  
 -- Accessing the Input --

 Once the player has decided on what they will enter, the symbols that are
 displayed will be stored in the designated variable as a string. You can
 then perform string operations using script calls in your conditional branches
 to handle user input.

 --------------------------------------------------------------------------------
 ** Example
 
 A simple way to check whether the player input matches what you want is to
 use a script call like this:
 
   $game_variables[16] == "Hello"
 
 Which will check whether the value stored in variable 16 is equal to the
 string "Hello". Note that this system is case-sensitive.
 
 Because all values are stored as strings, if you are working with numerical
 inputs, you will need to convert it to a number first before comparing it
 against a number:
 
   $game_variables[16].to_i >= 1204
 
 Which will check whether the value stored in variable 16 is greater or equal
 to 1204.

 If you are familiar with Ruby you will be able to come up with all sorts of
 conditions.
   
#===============================================================================
=end
$imported = {} if $imported.nil?
$imported[:TH_SymbolDialSystem] = true
#===============================================================================
# ** Configuration
#===============================================================================
module TH
  module Symbol_Dial_System
  end
end
#===============================================================================
# ** Rest of Script
#===============================================================================
class Game_Message
  attr_reader :key_inputs
  
  alias :th_symbol_dial_system_clear :clear
  def clear
    th_symbol_dial_system_clear
    @key_inputs = []
  end
  
  def sym_input?  
    !@key_inputs.empty?
  end
end

class Window_SymbolInput < Window_NumberInput
  
  alias :th_symbol_dial_system_initialize :initialize
  def initialize(message_window)
    th_symbol_dial_system_initialize(message_window)
    @inputs = []
    @data = []
    @value = ""
  end

  def start    
    @data = $game_message.key_inputs.dup        
    @digits_max = @data.size
    @value = get_value
    @index = 0
    update_placement
    create_contents
    refresh
    open
    activate
  end
  
  def get_value    
    value = $game_variables[$game_message.num_input_variable_id].to_s.split("")
    if value.size != @data.size
      return init_value
    end
    value.each_with_index do |sym, i|
      @inputs[i] = @data[i].index(sym)
      unless @inputs[i]
        return init_value
      end
    end
    return value
  end
  
  def init_value
    @inputs = [0] * @digits_max
    return @data.collect {|arr| arr[0] }
  end
  
  def process_digit_change
    return unless active
    size = @data[@index].size
    if Input.repeat?(:UP) || Input.repeat?(:DOWN)
      Sound.play_cursor
      n = @inputs[@index]
      n = (n + 1) % size  if Input.repeat?(:UP)
      n = (n + size-1) % size if Input.repeat?(:DOWN)
      @inputs[@index] = n      
      refresh
    end
  end
  
  def refresh
    contents.clear
    change_color(normal_color)
    @value = @inputs.collect.with_index {|x, i| @data[i][x] }
    @digits_max.times do |i|
      rect = item_rect(i)
      rect.x += 1
      draw_text(rect, @value[i], 1)
    end
  end
  
  def process_ok
    Sound.play_ok
    $game_variables[$game_message.num_input_variable_id] = @value.join
    deactivate
    close
  end
end

class Window_Message < Window_Base
  
  alias :th_symbol_dial_system_create_all_windows :create_all_windows
  def create_all_windows
    th_symbol_dial_system_create_all_windows
    @symbol_window = Window_SymbolInput.new(self)
  end
  
  alias :th_symbol_dial_system_update_all_windows :update_all_windows
  def update_all_windows
    th_symbol_dial_system_update_all_windows
    @symbol_window.update
  end
  
  alias :th_symbol_dial_system_dispose_all_windows :dispose_all_windows
  def dispose_all_windows
    th_symbol_dial_system_dispose_all_windows
    @symbol_window.dispose
  end
  
  alias :th_symbol_dial_system_input_number :input_number
  def input_number
    if $game_message.sym_input?
      input_symbol
    else
      th_symbol_dial_system_input_number
    end
  end
  
  def input_symbol
    @symbol_window.start
    Fiber.yield while @symbol_window.active
  end
end

class Game_Interpreter      
  def set_symbols(id, inputs)
    $game_message.key_inputs[id-1] = inputs
  end
end