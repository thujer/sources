/**
 *******************************************************************************
 * @file    command.cpp
 * @author  Tomas Hujer
 * @version 0.1.0
 * @date    7.11.2023
 * @brief   Process commands in buffer with parameters
 *
 *******************************************************************************
 */


/*--------------------------------- Includes ---------------------------------*/
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "Command.h"
#include "Command.config.h"

/*---------------------------- Private variables -----------------------------*/
COMMAND::COMMAND()
{
}


COMMAND::~COMMAND()
{
}


void COMMAND::Init(const MASK eTarget, void* pCallerInstance)
{
  m_eTarget = eTarget;  
  m_pCallerInstance = pCallerInstance;

  ClearBuffer();
  m_bClearRequest = false;

  snprintf(m_sPrompt, sizeof(m_sPrompt), ">");
}


void COMMAND::stringToUpperCase(char* ptrString, size_t nSize) {

  for(uint8_t ix = 0; ix < nSize; ix++) {

    if((ptrString[ix] >= 'a') && (ptrString[ix] <= 'z')) {

      ptrString[ix] &= ~(1 << 5);

      if(ptrString[ix] == 0) {
        break;
      }
    }
  }
}


/**
 * @brief Get n-th (nOrder) string position
 */
int COMMAND::getParamPosition(uint8_t nOrder)
{
  uint nIndex = 0;

  // If order defined, skip n-order parameters
  if(nOrder) {

    // Count down order
    for(; nOrder; nOrder--)
    {
      for(; ; nIndex++)
      {
        // When string end found
        if(!m_commandBuffer[nIndex])
        {
          return -1;
        }

        // End of parameter -> move to next parameter begin
        if((m_commandBuffer[nIndex] == ' ') ||
           (m_commandBuffer[nIndex] == ':') ||
           (m_commandBuffer[nIndex] == '|'))
        {
          // Skip next char (space)
          nIndex++;
          break;
        }
      }
    }
  }

  return nIndex;
}


/**
 * @brief Get n-th (nOrder) string pointer
 */
char* COMMAND::getParamPtr(uint8_t nOrder)
{
  uint nIndex = 0;

  // If order defined, skip n-order parameters
  if(nOrder) {

    // Count down order
    for(; nOrder; nOrder--)
    {
      for(; ; nIndex++)
      {
        // When string end found
        if(!m_commandBuffer[nIndex])
        {
          return nullptr;
        }

        // End of parameter -> move to next parameter begin
        if((m_commandBuffer[nIndex] == ' ') ||
           (m_commandBuffer[nIndex] == ':') ||
           (m_commandBuffer[nIndex] == '|'))
        {
          // Skip next char (space)
          nIndex++;
          break;
        }
      }
    }
  }

  return m_commandBuffer + nIndex;
}


/**
 * @brief Returns parameters count
 */
int COMMAND::GetParamCount()
{
  int nCount = 0;

  for(uint32_t nIx = 0; nIx < sizeof(m_commandBuffer); nIx++)
  {
    if(m_commandBuffer[nIx] == '\n')
    {
      break;
    }

    if((m_commandBuffer[nIx] == ' ') ||
       (m_commandBuffer[nIx] == ':') ||
       (m_commandBuffer[nIx] == '|'))
    {
      nCount++;
    }
  }

  return nCount;
}


/**
 * @brief Returns parameters count
 */
int COMMAND::getColonCount()
{
  int nCount = 0;

  for(uint32_t nIx = 0; nIx < sizeof(m_commandBuffer); nIx++)
  {
    if((m_commandBuffer[nIx] == '\r') ||
       (m_commandBuffer[nIx] == '\n') ||
       (m_commandBuffer[nIx] == '=') /*||
       (m_commandBuffer[nIx] == ' ')*/)
    {
      break;
    }

    if(m_commandBuffer[nIx] == ':')
    {
      nCount++;
    }
  }

  return nCount;
}


/**
 * @brief Get number from n-th parameter
 * 1 = first parameter
 * If parameter starts by 0x, then will be converted from hex to dec
 */
int COMMAND::getNumber(uint8_t nOrder)
{
  int nIndex = getParamPosition(nOrder);

  // Only for RG320
  if(m_commandBuffer[nIndex] == 'S') {
    nIndex++;
  }

  // If not some bug in conversion
  if(nIndex != -1)
  {
    if((m_commandBuffer[nIndex] == '0') &&
       (m_commandBuffer[nIndex+1] == 'x'))
    {
      char hexBuf[5];
      for(uint32_t nIx=0; nIx < sizeof(hexBuf); nIx++)
      {
        char ch = m_commandBuffer[nIndex + nIx + 2];
        if(ch == '\n')
        {
          hexBuf[nIx] = 0;
          break;
        }
        else
        {
          hexBuf[nIx] = ch;
        }
      }
      hexBuf[sizeof(hexBuf) - 1] = 0;

      return (int) strtoul(hexBuf, NULL, 16);
    }

    // Return number from current index converted to integer
    return atoi(m_commandBuffer + nIndex);
  }
  else
  {
    return 0;
  }
}


/**
 * @brief Compare string with string on n-th parameter position
 * @param p_strToCompare  Pointer to string to compare
 * @param nOrder          Position of string to compare with (1 = first parameter)
 */
bool COMMAND::CompareString(const char* p_strToCompare, uint8_t nOrder)
{
  uint nIx = 0;

  int nIndex = getParamPosition(nOrder);

  // If end of string found
  if(nIndex == -1)
  {
    return false;
  }

  // Forward index to parameter end
  for(; ; nIx++)
  {
    // When string end found
    if(!m_commandBuffer[nIndex + nIx] || !p_strToCompare[nIx])
    {
      return true;
    }

    // End of parameter -> move to next parameter begin
    if(m_commandBuffer[nIndex + nIx] == ' ')
    {
      break;
    }

    // If char not equal
    if(m_commandBuffer[nIndex + nIx] != p_strToCompare[nIx])
    {
      return false;
    }
  }

  // Return number from current index converted to integer
  return false;
}


/**
 * @brief Compare all command strings, if some result write command id to pointer
 * @param   p_eCmdId  Pointer to output command id pointer
 * @return            If some command match detected, then returns true, otherwise returns false
 */
bool COMMAND::CommandParse(ID* p_eCmdId)
{
    bool found = false;

    auto nArrayLength = sizeof(g_arr_Cmd) / sizeof(COMMAND::COMMAND_ITEM);

    stringToUpperCase(m_commandBuffer, sizeof(m_commandBuffer));

    for(uint8_t i=0; i < nArrayLength; i++)
    {
      
      //printf("MASK %d : %d = %d\r\n", (uint8_t) m_eTarget, (uint8_t) g_arr_Cmd[i].eTarget, (uint8_t) m_eTarget & (uint8_t) g_arr_Cmd[i].eTarget);

      // Check command enable mask
      if((uint8_t) m_eTarget & (uint8_t) g_arr_Cmd[i].eTarget) {

        int res = strncasecmp(m_commandBuffer, g_arr_Cmd[i].str, strlen(g_arr_Cmd[i].str));
        if(!res)
        {
          found = true;

          *p_eCmdId = g_arr_Cmd[i].val;
        }
      }
    }

    return found;
}


bool COMMAND::CommandParse(ID* p_eCmdId, char* p_Buf, size_t nBufSize)
{
    bool found = false;

    auto nArrayLength = sizeof(g_arr_Cmd) / sizeof(COMMAND::COMMAND_ITEM);

    stringToUpperCase(p_Buf, nBufSize);

    for(uint8_t i=0; i < nArrayLength; i++)
    {
      //printf("MASK %d : %d = %d\r\n", (uint8_t) m_eTarget, (uint8_t) g_arr_Cmd[i].eTarget, (uint8_t) m_eTarget & (uint8_t) g_arr_Cmd[i].eTarget);

      // Check command enable mask
      if((uint8_t) m_eTarget & (uint8_t) g_arr_Cmd[i].eTarget) {

        int res = strncasecmp(p_Buf, g_arr_Cmd[i].str, strlen(g_arr_Cmd[i].str));
        if(!res)
        {
          found = true;

          *p_eCmdId = g_arr_Cmd[i].val;
        }

        /*
        char *result = strstr(p_Buf, g_arr_Cmd[i].str);
        if(result != NULL) {
          found = true;
          *p_eCmdId = g_arr_Cmd[i].val;
        }
        */

      }
    }

    return found;
}


/**
 * @brief Prepare command list to buffer
 * @note Useful to make command list report, for ex. help command
 * @param nBufSize  Max size of command list report
 */
void COMMAND::GetCommandList(char *ptrBuf, int nBufSize)
{
  int nIndex = 0;

  nIndex += snprintf(ptrBuf + nIndex, nBufSize - nIndex, "CMDs\r\n---\r\n");
  
  auto nArrayLength = sizeof(g_arr_Cmd) / sizeof(COMMAND::COMMAND_ITEM);

  for(uint8_t i=0; i < nArrayLength; i++)
  {
    nIndex += snprintf(ptrBuf + nIndex, nBufSize - nIndex, "%s %s\r\n", g_arr_Cmd[i].str, g_arr_Cmd[i].note);
  }

  nIndex += snprintf(ptrBuf + nIndex, nBufSize - nIndex, "---\r\n");

}


void COMMAND::ClearBuffer() {
  m_nBufferIndex = 0;
  memset(m_commandBuffer, 0, sizeof(m_commandBuffer));
}


COMMAND::ID COMMAND::parseBuffer(char *ptrBuf, size_t nBufSize, USER_DATA* roUserData) {

    COMMAND::ID cmdId;

    size_t nLenght = nBufSize;
    if(nLenght >= sizeof(m_commandBuffer)) {
      nLenght = sizeof(m_commandBuffer) - 1;
    }

    m_nBufferIndex = nLenght;

    // Copy command to cache (for getCommand)
    memcpy(m_commandBuffer, ptrBuf, nLenght);

    stringToUpperCase(m_commandBuffer, nLenght);

    // Mark end of string
    m_commandBuffer[nLenght] = 0;

    // Zavoláme callback, pokud není NULL
    if(COMMAND::CommandParse(&cmdId, ptrBuf, nBufSize))
    {
      Notify(cmdId, roUserData);
      return cmdId;
    }
    else
    {
      Notify(COMMAND::ID::UNKNOWN, roUserData);
    }
  
    return COMMAND::ID::UNKNOWN;
}


/**
 * @brief Read input and process RTT commands
 */
COMMAND::ID COMMAND::IncomingChar(char ch)
{
  COMMAND::ID cmdID = COMMAND::ID::NONE;

  switch(ch) {
    case 13:
      if(!m_nBufferIndex) {
        Notify(COMMAND::ID::NONE);
        break;
      }

      COMMAND::ID _cmdId;

      if(COMMAND::CommandParse(&_cmdId))
      {
        cmdID = _cmdId;
        Notify(_cmdId);
      }
      else
      {
        Notify(COMMAND::ID::UNKNOWN);
        //printf("Command not found [%s]\r\n", m_RTT_Buffer);
      }

      m_bClearRequest = true;
      break;

    case 10:
      break;

    case 8: // Backspace
      m_nBufferIndex--;
      m_commandBuffer[m_nBufferIndex] = 0;
      break;

    default:
      //printf("BufSize %d vs %d [ix: %d]\r\n", m_nBufferIndex, g_cnBufferSize, m_nBufferIndex);

      if(m_nBufferIndex < g_cnBufferSize) {
        m_commandBuffer[m_nBufferIndex] = ch;
        m_nBufferIndex++;
      }
      break;
  }

  return cmdID;
}


/**
 * @brief Register callback to command match notification
 * @param   cpcSubscriber   Pointer to function type void with param (const ON_STATE_CHANGED_DATA& rcData);
 * @return  Result of subscriber addition
 */
COMMAND::RESULT COMMAND::AddSubscriber(const ON_STATE_CHANGED_FUNC* const cpcSubscriber)
{
  if (cpcSubscriber == nullptr)
  {
    return RESULT::GENERIC_ERROR;
  }

  SUBSCRIBER* pSubscriberSlot = nullptr;

  /**
    * @brief At the same time we shall check, that the subscriber was not register yet and
    * we shall find the "free" slot (callback pointer is nullptr). In this case return OK, otherwise
    * return error.
    */

  for(uint8_t ix = 0; ix < sizeof(m_arr_SubscriberList) / sizeof(COMMAND::SUBSCRIBER); ix++)
  {
    auto roSlot = m_arr_SubscriberList[ix];

    const bool cbSeekForFreeSlot  = (pSubscriberSlot      == nullptr);
    const bool cbIsSlotFree       = (roSlot.m_pcCallback  == nullptr);
    const bool cbIsAlreadyAdded   = (roSlot.m_pcCallback  == cpcSubscriber);

    if (cbIsAlreadyAdded)
    {
      return RESULT::GENERIC_ERROR;
    }

    if ((cbSeekForFreeSlot) && (cbIsSlotFree))
    {
      m_arr_SubscriberList[ix].m_pcCallback = cpcSubscriber;

      for(uint8_t ix = 0; ix < sizeof(m_arr_SubscriberList) / sizeof(COMMAND::SUBSCRIBER); ix++)
      {
        auto roSlot = m_arr_SubscriberList[ix];
      }

      return RESULT::OK;
    }
  }

  return RESULT::GENERIC_ERROR;
}


/**
 * @brief Remove callback from subscribers
 * @param   cpcSubscriber   Pointer to function type void with param (const ON_STATE_CHANGED_DATA& rcData);
 */
COMMAND::RESULT COMMAND::DelSubscriber(const ON_STATE_CHANGED_FUNC* pcSubscriber)
{
  for(uint8_t ix = 0; ix < sizeof(m_arr_SubscriberList); ix++) {

    if (m_arr_SubscriberList[ix].m_pcCallback == pcSubscriber)
    {
      m_arr_SubscriberList[ix].m_pcCallback = nullptr;
      m_arr_SubscriberList[ix].m_pUserData = nullptr;

      return RESULT::OK;
    }
  }

  return RESULT::GENERIC_ERROR;
}


/**
 * @brief Command match notification
 * @note  Distribute notification to all registered subscribers
 * @param eCMD_ID   Command ID
 */
void COMMAND::Notify(COMMAND::ID eCMD_ID)
{
  for (auto& roSubscriberData : m_arr_SubscriberList)
  {
    if  (roSubscriberData.m_pcCallback == nullptr)
    {
      continue;
    }

    roSubscriberData.m_pcCallback
    (
        ON_STATE_CHANGED_DATA
        {
          eCMD_ID
          //roSubscriberData.m_pUserData
        }
    );
  }
}


void COMMAND::Notify(COMMAND::ID eCMD_ID, USER_DATA* userData)
{
  for (auto& roSubscriberData : m_arr_SubscriberList)
  {
    if  (roSubscriberData.m_pcCallback == nullptr)
    {
      continue;
    }

    //printf("Notify userData: %d\r\n", (uint32_t) userData);

    roSubscriberData.m_pcCallback
    (
        ON_STATE_CHANGED_DATA
        {
          eCMD_ID,
          userData,
          m_pCallerInstance
        }
    );
  }
}


char* COMMAND::GetCommand() {
  return m_commandBuffer;
}


void COMMAND::changePrompt(const char* csPrompt) {
  snprintf(m_sPrompt, sizeof(m_sPrompt), csPrompt);
  //printf("Prompt changed to %s\r\n", m_sPrompt);
}


int COMMAND::isPromptEqual(const char* csPrompt) {
  return (strncasecmp(m_sPrompt, csPrompt, sizeof(m_sPrompt)) == 0);
}


char* COMMAND::getPrompt() {
  return m_sPrompt;
}



void COMMAND::Exec() {
  if(m_bClearRequest) {
    ClearBuffer();
    m_bClearRequest = false;
  }
}