###--------------------------------------------------------------------------###
#  CP Page Conditions script                                                   #
#  Version 1.0a                                                                #
#                                                                              #
#      Credits:                                                                #
#  Original code by: Neon Black                                                #
#  Modified by:                                                                #
#                                                                              #
#  This work is licensed under the Creative Commons Attribution 3.0 Unported   #
#  License. To view a copy of this license, visit                              #
#  http://creativecommons.org/licenses/by/3.0/.                                #
#                                                                              #
#  You may not repost this script without permission from the original author  #
#  You may use this script commercially and non-commercially as long as you    #
#   credit both Neon Black and the RM Coallition and any other authors that    #
#   modified it.                                                               #
#                                                                              #
#      Contact:                                                                #
#  NeonBlack - neonblack23@live.com (e-mail) or "neonblack23" on skype         #
###--------------------------------------------------------------------------###

###--------------------------------------------------------------------------###
#      Revision information:                                                   #
#  V1.0a - 12.21.2012                                                          #
#   Fixed a text bug                                                           #
#  V1.0 - 12.15.2012                                                           #
#   Wrote and debugged main script                                             #
###--------------------------------------------------------------------------###

###--------------------------------------------------------------------------###
#      Instructions:                                                           #
#  Place this script in the "Materials" section of the scripts above main.     #
#  This script allows new page conditions to be added that are required        #
#  before a page will appear.  These page conditions get placed in comment     #
#  events.  In order of the script to see that a comment contains extra        #
#  conditions, the first line of the comment MUST be "extra conditions".       #
#  Below are the following commands this script recognizes.                    #
#                                                                              #
###-----                                                                -----###
#      Page Conditions:                                                        #
#  extra conditions                                                            #
#    When placed at the top of a comment box, the scipt will check the rest    #
#    of that comment box for extra conditions.                                 #
#                                                                              #
#  switch 5 on                                                                 #
#    Requires a switch to be turned on.  DOES NOT WORK WITH SELF SWITCHES.     #
#    The number "5" in the example can be replaced with any number.            #
#                                                                              #
#  variable 5 = 2                                                              #
#    Requires a variable to be a specific value.  The number "5" in the        #
#    example can be any number and refers to the switch ID.  The number "2"    #
#    in the example is the number that the condition compares to the           #
#    variable.  You can use the comparison operators: =, >, <, >=, <=          #
#                                                                              #
#  item 5 -or- weapon 5 -or- armor 5                                           #
#    Checks if the party has the item, weapon, or armour with ID "5".  "5"     #
#    from the example can be any number.                                       #
#                                                                              #
#  actor 5                                                                     #
#    Checks if an actor is in the party.  The "5" can be replaced with any     #
#    actor ID.                                                                 #
#                                                                              #
#  timer 1:30                                                                  #
#    Checks if the timer is below (or equal to) a designated time.  The        #
#    "1:30" can be replaced by any value as long as it has a colon.            #
#                                                                              #
#  script foo == bar                                                           #
#    Evaluates everything after "script".  If true is returned the condition   #
#    is met.  This is not checked every frame, so it may be best to avoid      #
#    unless you know what you're doing.                                        #
#                                                                              #
#  day Wednesday -or- day 25                                                   #
#    Compares the current day against a day of the week or a day of the        #
#    month.                                                                    #
#                                                                              #
#  month April -or- month 4                                                    #
#    Compares the current month against a month name or number.                #
#                                                                              #
#  date 12/25                                                                  #
#    Compares the current date to a set date.  Note that the format MUST be    #
#    month/day.                                                                #
#                                                                              #
#  year 2052                                                                   #
#    Compares the current year against a set year.  Honestly I don't see much  #
#    need for this.                                                            #
#                                                                              #
#  date before 12/25 -or- date after 12/25                                     #
#    Checks if the current date is before or after a set date.  If the date    #
#    is the same as the set date IT COUNTS AS AFTER.                           #
#                                                                              #
#  time before 12:30 -or- time after 12:30                                     #
#    Compares the current time to a set time.  This works the same as the      #
#    "date before" type command.  Note that this uses 24 hour syntax, so       #
#    5:40 PM would be written as 17:40.                                        #
###--------------------------------------------------------------------------###


###--------------------------------------------------------------------------###
#  The following lines are the actual core code of the script.  While you are  #
#  certainly invited to look, modifying it may result in undesirable results.  #
#  Modify at your own risk!                                                    #
###--------------------------------------------------------------------------###


class Game_Event < Game_Character
  alias cp_new_conditions conditions_met?
  def conditions_met?(page)
    return (cp_new_conditions(page) && page.extra_conditions)
  end
end

class RPG::Event::Page
  def extra_conditions
    @ex_conditions = setup_extra_conditions if @ex_conditions.nil?
    @ex_conditions.each do |cond|
      next if cond.test_condition
      return false
    end
    return true
  end
  
  def setup_extra_conditions
    return [] if self.list.nil? || self.list.empty?
    temp = []
    adding_condition = false
    self.list.each do |line|
      case line.code
      when 108
        adding_condition = false
        adding_condition = true if line.parameters[0] =~ /extra condition[s]?/i
      when 408
        next unless adding_condition
        temp.push(Page_Condition.new(line.parameters[0]))
      else
        adding_condition = false
      end
    end
    return temp
  end
end

class Page_Condition
  def initialize(string)
    @string = string
    create_condition
  end
  
  def create_condition
    case @string
    when /switch (\d+) on/i
      @type = :switch
      @v1 = $1.to_i
    when /variable (\d+) (=|==|>=|<=|>|<) (\d+)/i
      @type = :variable
      @v1 = $1.to_i
      @v2 = $2.to_s
      @v3 = $3.to_i
    when /(item|weapon|armor|armour) (\d+)/i
      @type = $1.to_sym.downcase
      @v1 = $2.to_i
    when /actor (\d+)/i
      @type = :actor
      @v1 = $1.to_i
    when /script (.+)/i
      @type = :script
      @v1 = $1.to_s
    when /day (sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
      @type = :weekday
      @v1 = $1.to_s.upcase
    when /month (January|February|March|April|May|June|July|August|September|October|November|December)/i
      @type = :namemonth
      @v1 = $1.to_s.upcase
    when /day (\d+)/i
      @type = :day
      @v1 = $1.to_i
    when /month (\d+)/i
      @type = :month
      @v1 = $1.to_i
    when /date (\d+)\/(\d+)/i
      @type = :date
      @v1 = $1.to_i
      @v2 = $2.to_i
    when /year (\d+)/i
      @type = :year
      @v1 = $1.to_i
    when /date (before|after) (\d+)\/(\d+)/i
      @type = :targetdate
      @v1 = $1.to_s.upcase
      @v2 = $2.to_i
      @v3 = $3.to_i
    when /time (before|after) (\d+):(\d+)/i
      @type = :targettime
      @v1 = $1.to_s.upcase
      @v2 = $2.to_i
      @v3 = $3.to_i
    when /timer (\d*):(\d+)/i
      @type = :timer
      @v1 = $1.to_i
      @v2 = $2.to_i
    else
      @type = :skip
    end
  end
  
  def test_condition
    case @type
    when :switch ## Checks if a switch is on
      return true if $game_switches[@v1]
    when :variable ## Checks the state of a variable
      case @v2
      when '=', '=='
        return true if $game_variables[@v1] == @v3
      when '>='
        return true if $game_variables[@v1] >= @v3
      when '<='
        return true if $game_variables[@v1] <= @v3
      when '>'
        return true if $game_variables[@v1] > @v3
      when '<'
        return true if $game_variables[@v1] < @v3
      end
    when :item ## Checks if an item is held
      item = $data_items[@v1]
      return true if $game_party.has_item?(item)
    when :weapon ## Checks if a weapon is held
      item = $data_weapons[@v1]
      return true if $game_party.has_item?(item, true)
    when :armor, :armour ## Checks if an armour is held
      item = $data_armors[@v1]
      return true if $game_party.has_item?(item, true)
    when :actor ## Checks if an actor is in the party
      actor = $game_actors[@v1]
      return true if $game_party.members.include?(actor)
    when :script ## Checks if a script is true
      return true if eval(@v1) rescue return false
    when :weekday ## Checks for a certain day of the week
      return true if Time.new.strftime("%A").upcase == @v1
    when :namemonth ## Checks for a certain month of the year
      return true if Time.new.strftime("%B").upcase == @v1
    when :day ## Checks for a certain day date
      return true if Time.new.day == @v1
    when :month ## Checks for a certain month date
      return true if Time.new.mon == @v1
    when :date ## Checks for a certain day in the form of mm/dd
      return true if Time.new.mon == @v1 && Time.new.day == @v2
    when :year ## Checks for a certain year
      return true if Time.new.year == @v1
    when :targetdate ## Checks for before or after a certain date
      mon = Time.new.mon
      day = Time.new.day
      if @v1 == "BEFORE"
        return true if mon < @v2
        if mon == @v2
          return true if day < @v3
        end
      else
        return true if mon > @v2
        if mon == @v2
          return true if day >= @v3
        end
      end
    when :targettime ## Checks for before or after a certain time
      hour = Time.new.hour
      min = Time.new.min
      if @v1 == "BEFORE"
        return true if hour < @v2
        if hour == @v2
          return true if min < @v3
        end
      else
        return true if hour > @v2
        if hour == @v2
          return true if min >= @v3
        end
      end
    when :timer ## Checks if a timer is below a certain time
      sec = @v1 * 60 + @v2
      return true if $game_timer.sec <= sec
    when :skip
      return true
    end #end case
    return false
  end
end


###--------------------------------------------------------------------------###
#  End of script.                                                              #
###--------------------------------------------------------------------------###