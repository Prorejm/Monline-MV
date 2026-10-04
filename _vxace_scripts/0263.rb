################################################################################

#                                                                              #

#                    ** Cheat Code Engine by Riff **                           #

#                                                                              #

################################################################################



################################################################################

#                                                                              #

#                               -----------                                    #

#                             — Description —                                  #

#                               -----------                                    #

#                                                                              #

#    This script provides a customizable cheat code engine. On the title scene #

#      you can now  a new option, naed by default 'Passwords', that will run   #

#      the cheat code input scene. This scene works just like the actor        #

#      changing name scene except for a few things :                           #

#                   - the 'Page' button at the bottom right has been replaced  #

#      by 'Leave' which will make the player leave the scene.                  #

#      It implies that all the code you set up must use characters of only the #

#      first page (alphanumeric characters, both down- and uppercase, and some #

#      special characters). You can change that page layout at line 468 at     #

#      your own risks.                                                         #

#                   - an additionnal window is used to display the result of   #

#      the input when hitting 'Ok'.                                            #

#                                                                              #

#    This script is easy to use yet quite powerful for script newbies but if   #

#      you feel more confident about your scripting skills you can customize   #

#      more to do whatever you want to do by adding new functionnalities. If   #

#      you do so you will only have to set up your instructions, the script    #

#      takes care of running your code.                                        #

#                                                                              #

################################################################################



################################################################################

#                                                                              #

#                                ------------                                  #

#                              — Terms Of Use —                                #

#                                ------------                                  #

#                                                                              #

#   . You are free to use this script in both commercial and non-commercial    #

#     games in whatever way that fits your needs.                              #

#   . You are free to edit this script in whatever way fits your needs.        #

#   . No compatibility issue will be fixed.                                    #

#   . For bug fixes or support, post at www.nerdynest.wordpress.com or at      #

#     www.rpgmakervxace.net (questions explicitly answered in this header will #

#     be ignored).                                                             #

#   . For additionnal features requests, post at www.rpgmakervxace.net.        #

#     However, note that you are not guaranteed                                #

#     to get it done(depending on the amount of work needed).                  #

#   . Full credits must be given to Riff.                                      #

#                                                                              #

################################################################################



################################################################################

#                                                                              #

#                       -------------------------------                        #

#                     — Concerning Compatibility issues —                      #

#                       -------------------------------                        #

#                                                                              #

#     This script :                                                            #

#                   + Modifies three classes                                   #

#                       / Scene_Title                                          #

#                       / Scene_Load                                           #

#                       / Window_TitleCommand                                  #

#                   + Overwrites one method                                    #

#                       / make_command_list           (Window_TitleCommand)    #

#                   + Alias four methods                                       #

#                       / start                       (Scene_Title)            #

#                       / create_command_window       (Scene_Title)            #

#                       / command_new_game            (Scene_Title)            #

#                       / on_load_success             (Scene_Load)             #

#                                                                              #

################################################################################



################################################################################

#                                                                              #

#                            ------------                                      #

#                          — Instructions —                                    #

#                            ------------                                      #

#                                                                              #

#  + Paste this scrpit under Materials.                                        #

#                                                                              #

#                            {The Basics}                                      #

#                                                                              #

#  + Customize the maximum length of your code in the first module. You can    #

#      also set the name under which the code scene will appear on the title   #

#      scene in this module. (by default it's 'Passwords')                     #

#  + Set all your codes in the CODES hash by following this template           #

#          CODES[:code] = [:code_name, :instruction1, :instruction2]           #

#    :code being the string the user has to input to trigger the code          #

#    :code_name being the name that is used when displaying the successful     #

#      input in the scene. ( reads like this :  code_name successfully entered #

#    :instruction being a piece of instructions of your code;                  #

#     You can have any number of instructions for a code.                      #

#     Write the instruction as a string (between simple quotes -''-)           #

#                                                                              #

#                                                                              #

#                          {Instructions}                                      #

#                                                                              #

#  + By default there are ten basic methods you can call as instructions:      #

#      --> add_gold(value) — adds set amount of gold to party's inventory      #

#              add_gold(500) will add 500G to your party's inventory.          #

#                                                                              #

#      --> add_armors(id1, id2, ...) — add all set armors to party's inventory #

#              add_armors(1, 2) will add armors 1 & 2 to your                  #

#                           party's inventory.                                 #

#                                                                              #

#      --> add_weapons(id1, id2, ...) — same as add_armors with weapons        #

#      --> add_items(id1, id2, ...) — same as add_armors with items            #

#                                     (key items included)                     #

#                                                                              #

#      --> turn_switches(id1, id2, ...) — set all parsed switches to true       #

#              turn_switches(1, 2) will set switches 1 & 2                      #

#                               to true.                                       #

#      --> set_variable(id, value) — set parsed variable to parsed value       #

#             set_variable(1, 2) will set variable 1 to the value 2            #

#                                                                              #

#      --> add_states(subject, id1, id2) — add parsed states to the subject.   # 

#          subject MUST be one of the following :                              #

#                    * -1 if you want to target the whole party                #

#                    * any actor id if you want to target that specific actor. #

#                    * an array of actor ids to target several actors.         #

#          add_states(-1, 2, 3) will add state 2 & 3 to the whole party        #

#                                                                              #

#      --> gain_exp(subject, value) — subject gains parsed amount of experience#

#          See add_states to know about the subject argument.                  #

#                gain_exp(1, 500) will make actor 1 gain 500 exp               #

#                                                                              #

#      --> add_actors(id1, id2, ...) — add parsed actors to the party.         #

#            add_actors(2, 3) will add actors 2 & 3 to the party if            #

#                         they're not already in it                            #

#                                                                              #

#      --> run_common_event(id) — run parsed common event (only one by call)   #

#            run_common_event(1) will call common event 1                      #

#                                                                              #

#      --> set_starting_map(map_id, x, y) — automatically leaves the code      #

#          scene and start a new game at the parsed location. Can be           #

#          considered as a stage selection instruction.                        #

#                                                                              #

#  + When setting your codes always put your instructions between simple       #

#    quotes and with the arguments already parsed in. For exemple :            #

#           CODES['CODE'] = ['Lowly Cheat'        ,                            #

#                            'add_gold(500)'      ,                            #

#                            'gain_exp(2, 1000)'  ,                            #

#                            'add_actors(2)'       ]                           #

#          If the player enters CODE then at the start of the next game the    #

#          player will get 500G, actor 2 will be added to its party and that   #

#          actor will get 1000 XP.                                             #

#                                                                              #

#    /!\ Note that even if add_actors if placed after gain_exp (or add_states) #

#        that actor can still be targeted by those as instructions are later   #

#        sorted so that actors are being added first thing at the start.       #

#                                                                              #

#                        {More Complex Instructions}                           #

#                                                                              #

#  + If you feel like tweaking a bit the script you can add your own methods   #

#    to the cheat code engine. To do so add those methods in the Cheat_Code    #

#    class. If you add basic instructions (such as the ten provided by default)#

#    then don't forget to also add them at the CheatCode_Interpreter class.    #

#                                                                              #

#  + Methods in the Cheat_Code class must eventually add  strings              #

#      to @instructions.                                                       #

#  + Methods in the CheatCode_Interpreter class can use any object or script   #

#      call you like.                                                          #

#                                                                              #

#  + For exemple, by only using default methods :                              #

#                                                                              #

#    class Cheat_Code                                                          #

#      def ultimate_gear(gear_id)                                              #

#        case gear_id                                                          #

#        when 1                                                                #

#          add_armors(12, 16, 17)                                              #

#          add_weapons(32)                                                     #

#        when 2                                                                #

#          add_armors(20, 25, 2)                                               #

#          add_weapons(45, 17)                                                 #

#        end                                                                   #

#      end                                                                     #

#    end                                                                       #

#                                                                              #

#    This instructions will do the exact same thing as if you'd parsed each    #

#      instructions separately but you can gain some time by using one same    #

#      method for multiple similar codes (here similar outfits given to the    #

#      player).                                                                #

#    You can now use 'ultimate_gear(1)' or 'ultimate_gear(2)' as instructions  #

#      for your codes.                                                         #

#                                                                              #

#  + By adding new basic methods :                                             #

#                                                                              #

#    class Cheat_Code                                                          #

#      def make_shiny_things                                                   #

#        @instructions << "make_shiny_things"                                  #

#      end                                                                     #

#    end                                                                       #

#                                                                              #

#    You have then to add the #make_shiny_things method to                     #

#      CheatCode_Interpreter                                                   #

#                                                                              #

#    class CheatCode_Interpreter                                               #

#      def make_shiny_things                                                   #

#        do whatever you want here !                                           #

#      end                                                                     #

#    end                                                                       #

#                                                                              #

#   Adding basic methods is a good way to gain to time if that instructions is #

#    used often (like adding gold or items)                                    #

#                                                                              #

################################################################################



($imported ||= {})['Riff_Cheats'] = true



#===============================================================================

# ** RIFF::CHEAT

#-------------------------------------------------------------------------------

# Module that stores all the cheats

#===============================================================================



module RIFF

  module CHEAT

    CODE_LENGTH = 10

    CODESCENE_BUTTON = 'Cheats'

    

    CODES = {}

    CODES[:code]  = [:name, :instructions1, :instructions2]
    
    CODES['SKIP1'] = ['Intro Skip', 'set_variable(99, 1)', 'set_starting_map(238, 8, 6)']

    CODES['SKIP2'] = ['Forest Skip', 'set_variable(99, 2)', 'set_starting_map(238, 8, 6)']
    
    CODES['SKIP3'] = ['Coastal Skip', 'set_variable(99, 3)', 'set_starting_map(238, 8, 6)']
    
    CODES['SKIP4'] = ['Demon Skip', 'set_variable(99, 4)', 'set_starting_map(238, 8, 6)']
    
    CODES['SKIP5'] = ['Desolate Skip', 'set_variable(99, 5)', 'set_starting_map(238, 8, 6)']
    
    CODES['SKIP6'] = ['Desert Skip', 'set_variable(99, 6)', 'set_starting_map(238, 8, 6)']
    
    CODES['SKIP7'] = ['Desert Skip 2', 'set_variable(99, 7)', 'set_starting_map(238, 8, 6)']
    
    CODES['SKIP8'] = ['Desert Skip 3', 'set_variable(99, 8)', 'set_starting_map(238, 8, 6)']

    CODES['SKIP9'] = ['Mythic Skip', 'set_variable(99, 9)', 'set_starting_map(238, 8, 6)']    
    
    CODES['IDDQD'] = ['God Mode', 'set_variable(99, 99)', 'set_starting_map(238, 8, 6)']
    
    CODES['IDCHOPPERS'] = ['Chainsaw Added', 'add_weapons(31)']
    
    CODES['Zelda'] = ['Green Tunic Added', 'add_armors(57)']
    
    CODES['Rosebud'] = ['1000G Added', 'add_gold(1000)']
    
    CODES['Kenkou'] = ['Arena/PXEPedia Completed', 'turn_switches(101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180)']

    CODES['Arena'] = ['Arena Unlocked', 'turn_switches(46)']
  end

end



#===============================================================================

# ** Cheat_Code

#-------------------------------------------------------------------------------

# New class that handles codes instructions

#===============================================================================



class Cheat_Code

  attr_accessor :instructions

  attr_reader   :name

  attr_reader   :stage_code

  

  #--------------------------------------------------------------------------

  # * Object Initialization

  #--------------------------------------------------------------------------

  def initialize(name, instructions)

    @name         = name

    @stage_code   = false

    @instructions = []

    instructions.each{ |instruction|

      eval(instruction) }

  end

  

  #--------------------------------------------------------------------------

  # * Delete Specified Instruction of @instructions Array

  #--------------------------------------------------------------------------

  def delete(instruction)

    @instructions.delete(instruction)

  end

  

  #-----------------------------------------------------------------------------

  # All The Basic Methods You Can Call In More Complex Ones

  #-----------------------------------------------------------------------------

  def add_gold(value)                  ; @instructions << "add_gold(#{value})"                      end

  def add_armors(*args)                ; @instructions << "add_armors(#{args})"                     end

  def add_weapons(*args)               ; @instructions << "add_weapons(#{args})"                    end

  def add_items(*args)                 ; @instructions << "add_items(#{args})"                      end

  def turn_switches(*args)             ; @instructions << "turn_switches(#{args})"                  end

  def set_variable(variable_id, value) ; @instructions << "set_variable(#{variable_id}, #{value})"     end

  def add_states(subject, *args)       ; @instructions << "add_states(#{subject}, #{args})"         end

  def gain_exp(subject, value)         ; @instructions << "gain_exp(#{subject}, #{value})"          end

  def add_actors(*args)                ; @instructions << "add_actors(#{args})"                     end

  def run_common_event(event_id)       ; @instructions << "run_common_event(#{event_id})"           end

  def set_starting_map(map_id, x, y)   

    @instructions << "set_starting_map(#{map_id}, #{x}, #{y})"

    @stage_code = true

  end

end

  

#===============================================================================

# ** CheatCode_Interpreter

#-------------------------------------------------------------------------------

# New class that runs all the cheat codes

#===============================================================================

class CheatCode_Interpreter

  #--------------------------------------------------------------------------

  # * Object Initialization

  #--------------------------------------------------------------------------

  def initialize

    sort_codes

    @instructions.each{ |instruction|

      begin

        eval(instruction)

      rescue

        next

      end}

    $cheat_code = []

  end

  

  #--------------------------------------------------------------------------

  # * Convert Code Array Into an Instructions Array And Sort It

  #--------------------------------------------------------------------------

  def sort_codes

    @temp_instructs = []

    $cheat_code.each{ |code|

      code.instructions.each{ |instruction| ; @temp_instructs << instruction } }

    @temp_instructs.each{ |instruction|

      if instruction =~ /add_actors(\.*)/ 

        (@actors_instructs ||= []) << instruction 

         @temp_instructs.delete(instruction)

       end}

    @instructions = (@actors_instructs ||= []) + @temp_instructs

  end

  

  #--------------------------------------------------------------------------

  # * All basic methods equivalents

  #--------------------------------------------------------------------------

  def add_gold(value)

    $game_party.gain_gold(value)

  end

  

  def add_armors(armors)

    armors.each{ |id|

      $game_party.gain_item($data_armors[id], 1)}

  end

  

  def add_weapons(weapons)

    weapons.each{ |id|

      $game_party.gain_item($data_weapons[id], 1)}

  end

  

  def add_item(item, amount)

    items.each{ |id|

      $game_party.gain_item($data_items[id], amount)}

  end

  

  def turn_switches(switches)

    switches.each{ |switch_id|

      $game_switches[switch_id] = true }

  end

  

  def set_variable(variable_id, value)

    $game_variables[variable_id] = value

  end

  

  def add_states(subject, states)

    targets = get_subject(subject)

    if !targets.nil?

      states.each{ |state_id|

        targets.each{ |actor| ; actor.add_state(state_id) if actor} }

    end

  end



  def gain_exp(subject, value)

    targets = get_subject(subject)

    targets.each{ |actor| ; actor.gain_exp(value)} if !targets.nil?

  end

  

  def add_actors(actors)

    actors.each{ |actor_id|

      $game_party.add_actor(actor_id) if $data_actors[actor_id]}

  end

  

  def run_common_event(event_id)

    SceneManager.scene.interpreter.setup($data_common_events[event_id].list)

  end

  

  #--------------------------------------------------------------------------

  # * Convert Integers Into Actors Array

  #--------------------------------------------------------------------------

  def get_subject(subjects)

    if subjects == -1

      return $game_party.all_members

    elsif subjects.integer?

      return [$game_actors[subjects]] if $game_actors[subjects]

    else

      subjects.each{ |actor_id|

        (t_subjects ||= []) << $data_actors[actor_id] if $data_actors[actor_id]}

      return t_subjects

    end

  end

end



#===============================================================================

# ** Scene_CodeInput

#-------------------------------------------------------------------------------

# Scene where the player input the codes

#===============================================================================

class Scene_CodeInput < Scene_MenuBase

  #--------------------------------------------------------------------------

  # * Prepare

  #--------------------------------------------------------------------------

  def prepare(max_char)

    @max_char = max_char

  end



  #--------------------------------------------------------------------------

  # * Start Processing

  #--------------------------------------------------------------------------

  def start

    super

    @edit_window  = Window_CodeEdit.new(RIFF::CHEAT::CODE_LENGTH)

    @check_window = Window_CodeCheck.new(@edit_window)

    @input_window = Window_CodeInput.new(@edit_window)

    @input_window.y = @check_window.y + @check_window.height + 8

    @input_window.set_handler(:ok, method(:on_input_ok))

    @input_window.set_handler(:cancel, method(:return_scene))

  end



  #--------------------------------------------------------------------------

  # * Input [OK]

  #--------------------------------------------------------------------------

  def on_input_ok

    if check_validity(@edit_window.name)

      @current_code = Cheat_Code.new(RIFF::CHEAT::CODES[@edit_window.name][0], RIFF::CHEAT::CODES[@edit_window.name][1..-1])

      @check_window.success(@current_code.name)

      Sound.play_ok
      
      if @current_code.stage_code

        @current_code.instructions.each{ |instruction| 

          next unless instruction =~ /set_starting_map(\.*)/ 

          @stage_instruction = instruction

          @current_code.delete(@stage_instruction) }

        $cheat_code << @current_code

        eval(@stage_instruction)

      else

        $cheat_code << @current_code

        @edit_window.restore_default

      end

    else

      @check_window.fail

      Sound.play_buzzer

      @edit_window.restore_default

    end

  end

  

  #--------------------------------------------------------------------------

  # * Check Input String's Validity

  #--------------------------------------------------------------------------

  def check_validity(code)

    return RIFF::CHEAT::CODES.include?(code)

  end



  #--------------------------------------------------------------------------

  # * Handle Stage Selection Instructions

  #--------------------------------------------------------------------------

  def set_starting_map(map_id, x, y)

    SceneManager.clear

    DataManager.load_database

    $game_party.setup_starting_members

    $game_map.setup(map_id)

    $game_player.moveto(x, y)

    $game_player.refresh

    SceneManager.call(Scene_Map)

    $game_map.autoplay

    CheatCode_Interpreter.new

  end

end



#===============================================================================

# ** Window_CodeInput

#-------------------------------------------------------------------------------

# Window that is used to input the code

#===============================================================================

class Window_CodeInput < Window_NameInput

  #--------------------------------------------------------------------------

  # * Character Tables (Latin) [modified version]

  #--------------------------------------------------------------------------

  MOD_LATIN1 = [ 'A','B','C','D','E',  'a','b','c','d','e',

               'F','G','H','I','J',  'f','g','h','i','j',

               'K','L','M','N','O',  'k','l','m','n','o',

               'P','Q','R','S','T',  'p','q','r','s','t',

               'U','V','W','X','Y',  'u','v','w','x','y',

               'Z','[',']','^','_',  'z','{','}','|','~',

               '0','1','2','3','4',  '!','#','$','%','&',

               '5','6','7','8','9',  '(',')','*','+','-',

               '/','=','@','<','>',  ':',';',' ','Leave','OK']

            

  #--------------------------------------------------------------------------

  # * Get Text Table

  #--------------------------------------------------------------------------

  def table

    return [MOD_LATIN1, LATIN2]

  end

  

  #--------------------------------------------------------------------------

  # * Move to Next Page [modified to leave the scene instead]

  #--------------------------------------------------------------------------

  def cursor_pagedown

    SceneManager.scene.return_scene

  end

end



#===============================================================================

# ** Window_CodeCheck

#-------------------------------------------------------------------------------

# Window that displays the result of the input.

#===============================================================================

class Window_CodeCheck < Window_Base

  #--------------------------------------------------------------------------

  # * Object Initialization

  #--------------------------------------------------------------------------

  def initialize(edit_window)

    x = edit_window.x

    y = edit_window.y + edit_window.height + 8

    width  = edit_window.width

    height = edit_window.height

    super(x, y ,width, height)

  end

  

  #--------------------------------------------------------------------------

  # * Display Success Message

  #--------------------------------------------------------------------------

  def success(code)

    change_color(text_color(11))

    draw_text(contents.rect, "#{code}", 1)
    

  end

  

  #--------------------------------------------------------------------------

  # * Display Fail Message

  #--------------------------------------------------------------------------

  def fail

    change_color(text_color(18))

    draw_text(contents.rect, "Incorrect entry", 1)

  end

end



#===============================================================================

# ** Window_CodeEdit

#-------------------------------------------------------------------------------

# Window that handles the code display

#===============================================================================

class Window_CodeEdit < Window_NameEdit

  

  attr_reader   :name

  attr_reader   :index

  attr_reader   :max_char



  #---------------------------------------------------------------------------

  # * Object Initialization

  #---------------------------------------------------------------------------

  def initialize(max_char)

    x = (Graphics.width - 360) / 2

    y = (Graphics.height - (fitting_height(4) + fitting_height(10) + 12)) / 2

    self.class.superclass.superclass.instance_method(:initialize).bind(self).call(x, y, 360, fitting_height(2))

    @max_char = max_char

    @default_name = @name = ""

    @index = @name.size

    deactivate

    refresh

  end

  

  #--------------------------------------------------------------------------

  # * Get Rectangle for Displaying Item

  #--------------------------------------------------------------------------

  def item_rect(index)

    Rect.new(left + index * char_width, (self.height / 2) - 20, char_width, line_height)

  end

  

  #---------------------------------------------------------------------------

  # * Get Coordinates of Left Side for Drawing Name

  #---------------------------------------------------------------------------

  def left

    name_center = contents_width / 2

    name_width = (@max_char + 1) * char_width

    return [name_center - name_width / 2, contents_width - name_width].min

  end



  #--------------------------------------------------------------------------

  # * Refresh

  #--------------------------------------------------------------------------

  def refresh

    contents.clear

    @max_char.times {|i| draw_underline(i) }

    @name.size.times {|i| draw_char(i) }

    cursor_rect.set(item_rect(@index))

  end

end



#===============================================================================

# ** Scene_Title

#-------------------------------------------------------------------------------

# Modified to display a new button.

#===============================================================================

class Scene_Title < Scene_Base

  alias :riff_november_restaff_create_command_window :create_command_window

  alias :riff_november_restaff_start                 :start

  alias :riff_november_restaff_command_new_game      :command_new_game

  

  #---------------------------------------------------------------------------

  # * Start Processing

  #---------------------------------------------------------------------------

  def start

    riff_november_restaff_start

    $cheat_code ||= []

  end

  

  #---------------------------------------------------------------------------

  # * Create Command Window

  #---------------------------------------------------------------------------

  def create_command_window

    riff_november_restaff_create_command_window

    @command_window.set_handler(:passwords, method(:password_scene))

  end

  

  #---------------------------------------------------------------------------

  # * [Passwords] Command

  #---------------------------------------------------------------------------

  def password_scene

    close_command_window

    SceneManager.call(Scene_CodeInput)

  end

  

  #---------------------------------------------------------------------------

  # * [New Game] Command

  #---------------------------------------------------------------------------

  def command_new_game

    riff_november_restaff_command_new_game

    CheatCode_Interpreter.new

  end

end



#===============================================================================

# ** Window_TitleCommand

#-------------------------------------------------------------------------------

# Modified to display new button

#===============================================================================

class Window_TitleCommand < Window_Command

  

  #---------------------------------------------------------------------------

  # * Create Command List

  #---------------------------------------------------------------------------

  def make_command_list

    add_command(Vocab::new_game, :new_game)

    add_command(Vocab::continue, :continue, continue_enabled)

    add_command(RIFF::CHEAT::CODESCENE_BUTTON, :passwords)

    add_command(Vocab::shutdown, :shutdown)

  end

end



#===============================================================================

# ** Scene_Load

#-------------------------------------------------------------------------------

# Modified to run the CheatCode_Interpreter class when loading a game.

#===============================================================================

class Scene_Load < Scene_File

  alias :riff_november_restaff_on_load_success  :on_load_success

  

  #---------------------------------------------------------------------------

  # * Processing When Load Is Successful

  #---------------------------------------------------------------------------

  def on_load_success

    riff_november_restaff_on_load_success

    CheatCode_Interpreter.new

  end

end