# Command line library
Created on: 7. 11. 2023

Author: Tomas Hujer

## Prerequisite

- Need to add DEBUG definition
- RTT or other communication functional
- Commands are detected in RTT command buffer
- Optimized to use with YAT terminal

## YAT Terminal configuration

### Create button command to start rtt communication
Insert lines bellow into predefined command under button, name it for ex. RTT Enable
```
rtt setup 0x20000000 131072 "SEGGER RTT" 
rtt start
rtt server start 9090 0
rtt server start 9091 1
rtt server start 9092 2
```

Create 3 terminal window on ports 9090 - 9092

### Use saved terminal workspace

Terminal configuration is usually in directory src/Terminal.

Workspace have extension .yaw - open it in terminal by double click.

## Command ID definition
ID are defined in Command.h

For example:
```
enum class ID : uint8_t
{
    NONE = 0,
    HELP,
    START
}

```

## Command Text - Help - ID association
Command texts are defined in command.config.h

```
COMMAND::COMMAND_ITEM g_arr_Cmd[] = {
  {"HELP", "", COMMAND::ID::HELP},
  {"START", "", COMMAND::ID::START}
}
```

## Subscriber addition

Place code bellow into Init function
```
COMMAND::GetInstance().AddSubscriber
(
    (const COMMAND::ON_STATE_CHANGED_FUNC* const) 
    Test_CommandSubscriber
);
```

## Command subscriber example
```
void Test_CommandSubscriber(COMMAND::USER_DATA * cpData)
{
  auto cpStateChangedData = (COMMAND::ON_STATE_CHANGED_DATA *) cpData;

  SEGGER_RTT_printf(nTerminalID_Info, "COMMAND ID: %d\r\n", cpStateChangedData->eCommand);

  switch(cpStateChangedData->eCommand)
  {
    case COMMAND::ID::START:
      {
        if(COMMAND::GetInstance().CompareString("UP", 1))
        {
          printf("Start moving UP\r\n");
        }

        if(COMMAND::GetInstance().CompareString("DOWN", 1))
        {
          printf("Start moving DOWN\r\n");
        }
      }
      break;
  }
}
```

## Command detection
Place command Exec code (bellow) into Exec function
```
COMMAND::GetInstance().Exec();
```

## Getting command parameters

Example of subscriber using separated hex numbers as parameters
```
  void Test_CommandSubscriber(COMMAND::USER_DATA * cpData)
  {
    auto cpStateChangedData = (COMMAND::ON_STATE_CHANGED_DATA *) cpData;

    printf("COMMAND ID: %d\r\n", cpStateChangedData->eCommand);

    if(cpStateChangedData->eCommand == COMMAND::ID::SERVICE)
    {
      uint8_t dataBuf[20] = {0};

      int nParamCount = COMMAND::GetInstance().GetParamCount();

      for(uint8_t nIx = 0; nIx < nParamCount; nIx++)
      {
        auto nValue = COMMAND::GetInstance().GetNumber((uint8_t) (nIx + 1));

        dataBuf[nIx] = (uint8_t) nValue;
      }

      OnRxDataPacket(dataBuf, nParamCount);
    }
  }
```

Example of parameter text comparing
```
void CylinderControlTest_CommandSubscriber(COMMAND::USER_DATA * cpData)
{
  auto cpStateChangedData = (COMMAND::ON_STATE_CHANGED_DATA *) cpData;

  SEGGER_RTT_printf(nTerminalID_Info, "COMMAND ID: %d\r\n", cpStateChangedData->eCommand);

  switch(cpStateChangedData->eCommand)
  {
    case COMMAND::ID::WATCHDOG:
      if(COMMAND::GetInstance().CompareString("ENABLE", 1))
      {
        SEGGER_RTT_printf(nTerminalID_Info, "WatchDog enabled\n");
      }

      if(COMMAND::GetInstance().CompareString("DISABLE", 1))
      {
        SEGGER_RTT_printf(nTerminalID_Info, "WatchDog disabled\n");
      }
      break;
  }
}
```

## TODO
- Split command texts and IDs to define a specific set of commands
- Add UserData to command notification
