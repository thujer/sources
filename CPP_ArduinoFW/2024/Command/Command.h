/**
 *******************************************************************************
 * @file    command.h
 * @author  Tomas Hujer
 * @version
 * @date
 * @brief   Process commands in buffer with parameters
 *
 *******************************************************************************
 */

/*--------------------------------- Includes ---------------------------------*/
#ifndef SRC_COMMAND_COMMAND_H_
#define SRC_COMMAND_COMMAND_H_
#include <stdint.h>
#include <stddef.h>

class COMMAND
{

  public:

    using USER_DATA = void;

    /*
    struct USER_DATA {
        char sValue[100];
        const size_t nValueSize = sizeof(sValue);
    };
    */

    //! Commands ID's
    // Don't forget to add text value to command.config.h
    enum class ID : uint8_t
    {
      NONE = 0,
      UNKNOWN,

      // Terminal
      HELP,
      BAUDRATE,
      SWITCH,
      LED,

      // Gnome
      INIT,
      RESET,
      MODE,
      ID,
      REG,
      BRIDGE,
      EXIT,
      RP,
      WP,
      DS,
      DHA,
      CH,
      RC,

      // MQTT
      FW_UPDATE,
      COMM_LOOP_UPDATE,
      SAVE_ALL,
      COMMAND,
      TIME,
      ALIVE,

      // HTTP
      HTTP_STATUS,
      CONTENT_TYPE,

      // RG320
      LOADING_COMPLETE,
      INTRO_COMMAND,
      STARTING
    };

    enum class MASK: uint8_t
    {
      UNKNOWN     = 0,

      TERMINAL    = 1,
      GNOME       = 2,
      WS          = 4,
      MQTT        = 8,
      HTTP        = 16,
      RG320       = 32,

      GNOME_WS    = GNOME | WS,

      ALL         = 0xFF,
    };

    enum class RESULT: uint32_t
    {
      UNKNOWN = 0,

      OK,
      ALREADY_REGISTERED,

      GENERIC_ERROR,
    };

    struct ON_STATE_CHANGED_DATA
    {
      const ID    eCommand;
      USER_DATA*  m_pUserData;
      void*       m_pCallerInstance;
    };

    //! Command item structure
    struct COMMAND_ITEM
    {
      const char* str;
      const char* note;
      MASK eTarget; 
      ID val;
    };

    using ON_STATE_CHANGED_FUNC  = void (const ON_STATE_CHANGED_DATA& rcData);
    typedef void (*CallbackType) (COMMAND::ID);

    COMMAND();
    ~COMMAND();

    void Init(const MASK eTarget, void* pCallerInstance = NULL);
    void ClearBuffer();
    COMMAND::ID parseBuffer(char *ptrBuf, size_t nBufSize, USER_DATA* roUserData);
    COMMAND::ID IncomingChar(char ch);

    void stringToUpperCase(char* ptrString, size_t nSize);

    int getParamPosition(uint8_t nOrder);
    char* getParamPtr(uint8_t nOrder);
    int GetParamCount();
    int getColonCount();

    char* GetCommand();
    int getNumber(uint8_t nOrder);
    bool CompareString(const char* p_strToCompare, uint8_t nOrder);
    
    bool CommandParse(ID* p_eCmdId);
    bool CommandParse(ID* p_eCmdId, char* p_Buf, size_t nBufSize);
    
    void GetCommandList(char *ptrBuf, int nBufSize);

    RESULT AddSubscriber(const ON_STATE_CHANGED_FUNC* const cpcSubscriber);
    RESULT DelSubscriber(const ON_STATE_CHANGED_FUNC* pcSubscriber);

    void changePrompt(const char* csPrompt);
    int isPromptEqual(const char* csPrompt);
    char* getPrompt();

    void Exec();

  private:
    static constexpr uint32_t g_cnSubscribers_count = 10;
    static constexpr uint32_t g_cnBufferSize        = 50;

    uint8_t m_nBufferIndex;

    bool m_bClearRequest;

    MASK m_eTarget;

    char m_sPrompt[10] = "";

    void* m_pCallerInstance;

    struct SUBSCRIBER
    {
        const ON_STATE_CHANGED_FUNC* m_pcCallback;
        USER_DATA*                   m_pUserData;
    };

    SUBSCRIBER m_arr_SubscriberList[g_cnSubscribers_count];

    char m_commandBuffer[g_cnBufferSize];

    void Notify(ID eCMD_ID);
    void Notify(ID eCMD_ID, USER_DATA* userData);
};

#endif

