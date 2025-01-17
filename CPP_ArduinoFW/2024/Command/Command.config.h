/**
 *******************************************************************************
 * @file    command.config.h
 * @author  Tomas Hujer
 * @version
 * @date
 * @brief   Process commands in buffer with parameters
 *
 *******************************************************************************
 */

#ifndef __COMMAND_CONFIG_H__
#define __COMMAND_CONFIG_H__
#include "Command.h"

// Don't forget to add enum values to command.h
const COMMAND::COMMAND_ITEM g_arr_Cmd[] = {

  // All terminals
  {"SWITCH",    "Change consoles",                     COMMAND::MASK::ALL,      COMMAND::ID::SWITCH},

  // Debug terminal
  {"HELP",      "Show commands",                       COMMAND::MASK::TERMINAL, COMMAND::ID::HELP},
  {"RESET",     "Restart MCU",                         COMMAND::MASK::TERMINAL, COMMAND::ID::RESET},
  {"BAUDRATE",  "Set new baudrate on Serial1",         COMMAND::MASK::TERMINAL, COMMAND::ID::BAUDRATE},
  {"REG",       "Set prompt REG",                      COMMAND::MASK::TERMINAL, COMMAND::ID::REG},
  {"RP",        "Read parameter [Sxx:xx]",             COMMAND::MASK::TERMINAL, COMMAND::ID::RP},
  {"WP",        "Write parameter [Sxx:xx] [value]",    COMMAND::MASK::TERMINAL, COMMAND::ID::WP},
  {"DS",        "Describe segment [Sxx]",              COMMAND::MASK::TERMINAL, COMMAND::ID::DS},
  {"MODE",      "CMD|INT command or Interactive mode", COMMAND::MASK::ALL,      COMMAND::ID::MODE},

  // Gnome terminal
  {"INIT",      "Send INIT info",                      COMMAND::MASK::GNOME_WS, COMMAND::ID::INIT},
  {"ID",        "Send ID",                             COMMAND::MASK::GNOME_WS, COMMAND::ID::ID},
  {"REG",       "Change prompt to Reg>",               COMMAND::MASK::GNOME_WS, COMMAND::ID::REG},
  {"BRIDGE",    "Change prompt to Bridge>",            COMMAND::MASK::GNOME_WS, COMMAND::ID::BRIDGE},
  {"EXIT",      "Change prompt to >",                  COMMAND::MASK::GNOME_WS, COMMAND::ID::EXIT},
  {"RESET",     "Restart regulator",                   COMMAND::MASK::GNOME_WS, COMMAND::ID::RESET},
  {"RP",        "Read parameter [Sxx:xx]",             COMMAND::MASK::GNOME_WS, COMMAND::ID::RP},
  {"WP",        "Write parameter [Sxx:xx] [value]",    COMMAND::MASK::GNOME_WS, COMMAND::ID::WP},
  {"DS",        "Describe segment [Sxx]",              COMMAND::MASK::GNOME_WS, COMMAND::ID::DS},
  {"DHA",       "Read defects",                        COMMAND::MASK::GNOME_WS, COMMAND::ID::DHA},
  {"CH",        "Clear defects",                       COMMAND::MASK::GNOME_WS, COMMAND::ID::CH},
  {"RC",        "Read calorimeters [nID]",             COMMAND::MASK::GNOME_WS, COMMAND::ID::RC},

  // MQTT
  {"C:FW-UPDATE", "Firmware update",           COMMAND::MASK::MQTT, COMMAND::ID::FW_UPDATE},
  {"C:CL-UPDATE", "Comm loop update",          COMMAND::MASK::MQTT, COMMAND::ID::COMM_LOOP_UPDATE},

  {"T:CMD",       "RG320 command",             COMMAND::MASK::MQTT, COMMAND::ID::COMMAND},
  {"T:TIME",      "Time command",              COMMAND::MASK::MQTT, COMMAND::ID::TIME},
  {"T:ALIVE",     "Alive commmand",            COMMAND::MASK::MQTT, COMMAND::ID::ALIVE},
  {"T:SAVE-ALL",  "Save all",                  COMMAND::MASK::MQTT, COMMAND::ID::SAVE_ALL},

  {"TIME",        "Time command",              COMMAND::MASK::MQTT, COMMAND::ID::TIME},

  // HTTP/HTTPS
  {"HTTP/",       "HTTP Status",               COMMAND::MASK::HTTP, COMMAND::ID::HTTP_STATUS},
  {"Content-Type","Content type",              COMMAND::MASK::HTTP, COMMAND::ID::CONTENT_TYPE},

  // RG320
  {"STARTING",         "Restart",              COMMAND::MASK::RG320, COMMAND::ID::STARTING},
  {"COMMAND",          "Restart",              COMMAND::MASK::RG320, COMMAND::ID::INTRO_COMMAND},
  {"LOADING COMPLETE", "Intro done",           COMMAND::MASK::RG320, COMMAND::ID::LOADING_COMPLETE},
  
  // ALL
  {"LED",       "LED CHANGE",                  COMMAND::MASK::ALL, COMMAND::ID::LED},
};


#endif
