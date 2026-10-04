%Q(
+------------------------------------------------------------------------------+
¦ +--------------------------------------------------------------------------+ ¦
¦-¦                             Save File Doctor.                            ¦-¦
¦-¦                           by RPG Maker Source.                           ¦-¦
¦-¦                          www.rpgmakersource.com                          ¦-¦
¦ +--------------------------------------------------------------------------+ ¦
¦------------------------------------------------------------------------------¦
¦ +--------------------------------------------------------------------------+ ¦
¦-¦ Version 1.1.0                   28/05/15                        DD/MM/YY +-¦
¦ +--------------------------------------------------------------------------+ ¦
¦------------------------------------------------------------------------------¦
¦                                                                              ¦
¦               This work is protected by the following license:               ¦
¦     +------------------------------------------------------------------+     ¦
¦     ¦                                                                  ¦     ¦
¦     ¦ Copyright © 2014 Maker Systems.                                  ¦     ¦
¦     ¦                                                                  ¦     ¦
¦     ¦ This software is provided 'as-is', without any kind of           ¦     ¦
¦     ¦ warranty. Under no circumstances will the author be held         ¦     ¦
¦     ¦ liable for any damages arising from the use of this software.    ¦     ¦
¦     ¦                                                                  ¦     ¦
¦     ¦ Permission is granted to anyone to use this software on their    ¦     ¦
¦     ¦ free or commercial games made with a legal copy of RPG Maker     ¦     ¦
¦     ¦ VX Ace, as long as Maker Systems - RPG Maker Source is           ¦     ¦
¦     ¦ credited within the game.                                        ¦     ¦
¦     ¦                                                                  ¦     ¦
¦     ¦ Selling this code or any portions of it 'as-is' or as part of    ¦     ¦
¦     ¦ another code, is not allowed.                                    ¦     ¦
¦     ¦                                                                  ¦     ¦
¦     ¦ The original header, which includes this copyright notice,       ¦     ¦
¦     ¦ must not be edited or removed from any verbatim copy of the      ¦     ¦
¦     ¦ sotware nor from any edited version.                             ¦     ¦
¦     ¦                                                                  ¦     ¦
¦     +------------------------------------------------------------------+     ¦
¦                                                                              ¦
¦                                                                              ¦
¦------------------------------------------------------------------------------¦
¦ 1. VERSION HISTORY.                                                        ? ¦
¦------------------------------------------------------------------------------¦
¦                                                                              ¦
¦ • Version 1.0.0, 27/12/14 - (DD/MM/YY).                                      ¦
¦                                                                              ¦
¦ • Version 1.1.0, 28/05/15 - (DD/MM/YY).                                      ¦
¦                                                                              ¦
¦------------------------------------------------------------------------------¦
¦------------------------------------------------------------------------------¦
¦ 2. USER MANUAL.                                                            ? ¦
¦------------------------------------------------------------------------------¦
¦                                                                              ¦
¦ +--------------------------------------------------------------------------+ ¦
¦ ¦ ¦ Introduction.                                                          ¦ ¦
¦ +--------------------------------------------------------------------------+ ¦
¦                                                                              ¦
¦  Hello there! This script is "plug and play", you can simply insert it       ¦
¦  into your project and it will perform flawlessly.                           ¦
¦                                                                              ¦
¦  Save File Doctor aims to fix the most common problem encountered when       ¦
¦  loading a save file after adding a new script to your project.              ¦
¦                                                                              ¦
¦  The problem is usually caused by the lack of initialization for variables   ¦
¦  used in the recently created script. When loading an old save file, some    ¦
¦  things were already initialized and the new script will assume that's also  ¦
¦  the case for its own variables.                                             ¦
¦                                                                              ¦
¦  It is also useful for DLC or patching systems, since it would take care     ¦
¦  of said problem in case you add scripts that way.                           ¦
¦                                                                              ¦
¦  We hope you enjoy it.                                                       ¦
¦                                                                              ¦
¦  Thanks for choosing our products.                                           ¦
¦                                                                              ¦
¦------------------------------------------------------------------------------¦
¦------------------------------------------------------------------------------¦
¦ 3. NOTES.                                                                  ? ¦
¦------------------------------------------------------------------------------¦
¦                                                                              ¦
¦  Have fun and enjoy!                                                         ¦
¦                                                                              ¦
¦------------------------------------------------------------------------------¦
¦------------------------------------------------------------------------------¦
¦ 4. CONTACT.                                                                ? ¦
¦------------------------------------------------------------------------------¦
¦                                                                              ¦
¦  Need support? Post in our forums!                                           ¦
¦                                                                              ¦
¦  forums.rpgmakersource.com                                                   ¦
¦                                                                              ¦
¦  Keep in touch with us and be the first to know about new releases:          ¦
¦                                                                              ¦
¦  www.rpgmakersource.com                                                      ¦
¦  www.facebook.com/RPGMakerSource                                             ¦
¦  www.twitter.com/RPGMakerSource                                              ¦
¦  www.youtube.com/user/RPGMakerSource                                         ¦
¦                                                                              ¦
¦  Get involved! Have an idea for a system? Let us know.                       ¦
¦                                                                              ¦
¦  Spread the word and help us reach more people so we can continue creating   ¦
¦  awesome resources for you!                                                  ¦
¦                                                                              ¦
+------------------------------------------------------------------------------+)
 
#==============================================================================
# ** MakerSystems
#------------------------------------------------------------------------------
#  Module for our systems.
#==============================================================================
 
module MakerSystems
 
  #============================================================================
  # ** SaveFileDoctor
  #----------------------------------------------------------------------------
  #  Ph.D in game development and family care.
  #============================================================================
 
  module SaveFileDoctor
   
    #----------------------------------------------------------------------
    # * Custom Case for Game_Actors.                                  [NEW]
    #----------------------------------------------------------------------
    def self.custom_case_for_game_actors(patient, current)
      # Get data array that contains each Actor.
      patient_data = patient.instance_variable_get('@data')
      # Go through each Actor.
      patient_data.each do |actor|
        # Next if actor is nil. Needed because how Game_Actors handles [].
        next unless actor
        # Get current actor from current Game_Actors using patient's id.
        current_actor = current[actor.instance_variable_get('@actor_id')]
        # Fixes each of patient's Game_Actor objects.
        fix_object(actor, current_actor)
        # Healing process for each instance variable of this actor.
        child_health(object_data(actor), object_data(current_actor))
      end
    end
    #----------------------------------------------------------------------
    # * Heal.                                                         [NEW]
    #----------------------------------------------------------------------
    def self.heal(contents)
      # Will keep track of repaired objects to avoid a stack overflow.
      @ms_save_file_doctor_ids = []
      # Goes through each object in contents hash.
      contents.each_value do |patient|
        # Updated version of this Object.
        current = patient.class.new
        # Fixes this (loaded) Object  with the help of its updated version.
        fix_object(patient, current)
        # Starts the healing process for each instance variable.
        child_health(object_data(patient), object_data(current))
      end
      # No need to keep the objects ids in memory.
      @ms_save_file_doctor_ids = nil
    end
    #----------------------------------------------------------------------
    # * Enumerable Child Processing.                                  [NEW]
    #----------------------------------------------------------------------
    def self.enum_child(patient, current)
      # Iterates loaded version and updated version as a sequence.
      patient.zip(current).each do |p_value, c_value|
        # If Enumerable, there might be instanceable Objects inside it.
        enum_child(p_value.to_a, c_value.to_a) if Enumerable === p_value
        # Ignore if it can't be instanced.
        next unless p_value.class.respond_to?(:new)
        # Stop if this Object was already healed to avoid a stack overflow.
        return if @ms_save_file_doctor_ids.include?(p_value.__id__)
        # Saves current Object id.
        @ms_save_file_doctor_ids << p_value.__id__
        # Fixes this Object with the help of its updated version.
        fix_object(p_value, c_value)
        # Healing process for each instance variable of this Object.
        child_health(object_data(p_value), object_data(c_value))
      end
    end
    #----------------------------------------------------------------------
    # * Object Data.                                                  [NEW]
    #----------------------------------------------------------------------
    def self.object_data(object)
      # Returns a hash with each instance variable name and value.
      Hash[
        object.instance_variables.map do |name|
          [name, object.instance_variable_get(name)]
        end
      ]
    end
    #----------------------------------------------------------------------
    # * Fix Object.                                                   [NEW]
    #----------------------------------------------------------------------
    def self.fix_object(patient, current)
      # Name of the method that should especially handle this object.
      special = "custom_case_for_#{patient.class.name.downcase}"
      # Attempts special handling.
      send(special, patient, current) if respond_to?(special)
      # Adds new data to loaded Object's data target.
      data = object_data(current).merge!(object_data(patient))
      # Uses the correct data target to set each instance variable.
      data.each { |name, value| patient.instance_variable_set(name, value) }
    end
    #----------------------------------------------------------------------
    # * Child Health.                                                 [NEW]
    #----------------------------------------------------------------------
    def self.child_health(patient, current)
      # Goes through each instance variable.
      patient.each do |name, value|
        # If Enumerable, there might be instanceable Objects inside it.
        enum_child(value.to_a, current[name].to_a) if Enumerable === value
        # Ignore if it can't be instanced.
        next unless value.class.respond_to?(:new)
        # Stop if this Object was already healed to avoid a stack overflow.
        return if @ms_save_file_doctor_ids.include?(value.__id__)
        # Saves current Object id.
        @ms_save_file_doctor_ids << value.__id__
        # Fixes this Object with the help of its updated version.
        fix_object(value, current[name])
        # Healing process for each instance variable of this Object.
        child_health(object_data(value), object_data(current[name]))
      end
    end      
   
  end
 
end
 
#==============================================================================
# ** DataManager
#------------------------------------------------------------------------------
#  This module manages the database and game objects. Almost all of the
# global variables used by the game are initialized by this module.
#==============================================================================
 
module DataManager
 
  class << self
   
    #------------------------------------------------------------------------
    # * Alias Extract Save Contents.                                    [NEW]
    #------------------------------------------------------------------------
    alias_method(:ms_save_file_doctor_original_extract_save_contents,
                 :extract_save_contents)
    #------------------------------------------------------------------------
    # * Extract Save Contents.                                          [MOD]
    #------------------------------------------------------------------------
    def extract_save_contents(contents)
      @@tempSystem = contents[:system]
      #Check if New Version? Credit to Azerak
      if @@tempSystem.version_id != $data_system.version_id
        # Healthcare. Object repairing is handled at a local level.
        MakerSystems::SaveFileDoctor.heal(contents)
      end
      # Proceeds with the original method, using repaired contents.
      ms_save_file_doctor_original_extract_save_contents(contents)
    end
 
  end
 
end