
/*--------------------------------- Includes ---------------------------------*/
#include "motor_driver_pwm_sw.h"

#include "gpio_drv.h"
#include "PWM_SW_Driver/pwm_sw_driver.h"
#include "Sensor/sensor_current.h"

/*----------------------------- Public variables -----------------------------*/

/*------------------------------ Private types -------------------------------*/

/*------------------------------ Private macro -------------------------------*/

/*---------------------------- Private variables -----------------------------*/

/*----------------------- Private function prototypes ------------------------*/

/*----------------------------- Public functions -----------------------------*/
/**
 * @brief Initializes the PWM software motor driver.
 *
 * This function initializes the PWM software motor driver with the provided setup configuration.
 *
 * @param rcSetupBase The setup configuration for the motor driver.
 * @return The result of the initialization operation (OK if successful, GENERIC_ERROR otherwise).
 */
MOTOR_DRIVER_PWM_SW::RESULT  MOTOR_DRIVER_PWM_SW::Init(const MOTOR_DRIVER::SETUP& rcSetupBase)
{
  memcpy(m_arr_bySetupBuffer, &rcSetupBase, sizeof(m_arr_bySetupBuffer));

  auto& rThisSetup = *((const MOTOR_DRIVER_PWM_SW::SETUP*)m_arr_bySetupBuffer);

  MOTOR_DRIVER::Init(rThisSetup);

  const auto pcSetup = GetSetup();

  if (pcSetup == nullptr)
  {
    return RESULT::GENERIC_ERROR;
  }

  const auto& rcSetup = *pcSetup;

  {
    const auto ceChannel = (PWM_SW_DRIVER::CHANNEL)rcSetup.m_cnChannel;

    const auto ceResult = PWM_SW_DRIVER::Init(rcSetup.m_rcPinDrv_PWM, ceChannel);

    if (ceResult != PWM_SW_DRIVER::RESULT::OK)
    {
      return RESULT::GENERIC_ERROR;
    }
  }

  {
    const auto ceResult = GPIO_Init(rcSetup.m_rcPinDrv_Dir);

    if (ceResult != GPIO_RESULT_OK)
    {
      return RESULT::GENERIC_ERROR;
    }
  }

  PowerPinInit();

  m_fDuty = 0.0F;

  return RESULT::OK;
}

/**
 * @brief Deinitializes the PWM software motor driver.
 *
 * This function deinitializes the PWM software motor driver. It performs cleanup operations
 * such as disabling power, releasing pins, and invoking the deinitialization of the PWM channel.
 *
 * @return The result of the deinitialization operation (OK if successful, GENERIC_ERROR otherwise).
 */
MOTOR_DRIVER_PWM_SW::RESULT  MOTOR_DRIVER_PWM_SW::Deinit()
{
  const auto pcSetup = GetSetup();

  if (pcSetup == nullptr)
  {
    return RESULT::GENERIC_ERROR;
  }

  const auto& rcSetup = *pcSetup;

  PowerDisable();
  PowerPinDenit();

  PWM_SW_DRIVER::Deinit(rcSetup.m_rcPinDrv_PWM);

  return MOTOR_DRIVER::Deinit();
}

/**
 * @brief Executes the PWM software motor driver.
 *
 * This function executes the PWM software motor driver's behavior. It invokes the execution of the
 * base motor driver's behavior and returns a result indicating successful execution.
 *
 * @return The result of the execution operation (always returns OK).
 */
MOTOR_DRIVER_PWM_SW::RESULT MOTOR_DRIVER_PWM_SW::Exec()
{
  // Execute the base motor driver's behavior
  MOTOR_DRIVER::Exec();

  // Return the execution result (always OK in this case)
  return RESULT::OK;
}

/**
 * @brief Sets the power level for the PWM software motor driver.
 *
 * This function sets the power level for the PWM software motor driver by adjusting the duty cycle
 * of the PWM signal. The specified power level is applied to the motor driver's operation.
 *
 * @param cfPower The desired power level to set (0.0 to 100.0).
 * @return The result of the operation (OK if successful, GENERIC_ERROR otherwise).
 */
MOTOR_DRIVER_PWM_SW::RESULT MOTOR_DRIVER_PWM_SW::SetPower(const float cfPower)
{
  auto* pSetup = GetSetup();

  if (pSetup == nullptr)
  {
    return RESULT::GENERIC_ERROR;
  }

  const auto ceChannel = (PWM_SW_DRIVER::CHANNEL)pSetup->m_cnChannel;

  m_fDuty = cfPower;

  PWM_SW_DRIVER::SetDuty(ceChannel, m_fDuty);

  return RESULT::OK;
}

/**
 * @brief Sets the rotation direction for the PWM software motor driver.
 *
 * This function sets the rotation direction of the PWM software motor driver. It adjusts the GPIO
 * pin for direction control, updates the PWM duty cycle, and enables/disables power accordingly
 * based on the specified rotation direction.
 *
 * @param ceRotation The desired rotation direction to set.
 * @return The result of the operation (OK if successful, GENERIC_ERROR otherwise).
 */
MOTOR_DRIVER_PWM_SW::RESULT  MOTOR_DRIVER_PWM_SW::SetRotation(const ROTATION ceRotation)
{
  auto* pSetup = GetSetup();

  if (pSetup == nullptr)
  {
    return RESULT::GENERIC_ERROR;
  }

  MOTOR_DRIVER::SetRotation(ceRotation);

  const auto ceChannel = (PWM_SW_DRIVER::CHANNEL)pSetup->m_cnChannel;

  switch(ceRotation)
  {
    case ROTATION::CLOCKWISE :
    {
      GPIO_SetActive(pSetup->m_rcPinDrv_Dir);
      PWM_SW_DRIVER::SetDuty(ceChannel, m_fDuty);
      PowerEnable();
      break;
    }
    case ROTATION::COUNTER_CLOCKWISE :
    {
      GPIO_SetInactive(pSetup->m_rcPinDrv_Dir);
      PWM_SW_DRIVER::SetDuty(ceChannel, m_fDuty);
      PowerEnable();
      break;
    }
    case ROTATION::DISABLED :
    {
      PWM_SW_DRIVER::SetDuty(ceChannel, 0.0F);
      PowerDisable();
      break;
    }
    case ROTATION::UNKNOWN :
    case ROTATION::INVALID :
    default:
    {
      break;
    }
  }

  return RESULT::OK;
}

/**
 * @brief Retrieves the current power level of the PWM software motor driver.
 *
 * This function returns the current power level (duty cycle) set for the PWM software motor driver.
 *
 * @return The current power level of the motor driver (0.0 to 1.0).
 */
float MOTOR_DRIVER_PWM_SW::GetPower() const
{
  return m_fDuty;
}

/**
 * @brief Retrieves the current rotation direction of the PWM software motor driver.
 *
 * This function retrieves the current rotation direction of the PWM software motor driver and
 * returns it.
 *
 * @return The current rotation direction of the motor driver.
 */
MOTOR_DRIVER_PWM_SW::ROTATION  MOTOR_DRIVER_PWM_SW::GetRotation() const
{
  /** TODO: we also may to compare the "stored" value with hardware state and
   *  return the error in case is doesn't match
   */

  return MOTOR_DRIVER::GetRotation();
}

/**
 * @brief Retrieves the current position of the PWM software motor driver.
 *
 * This function retrieves the current position of the PWM software motor driver. Note that this
 * function is partially implemented and may require additional handling for position retrieval.
 *
 * @return The current position of the motor driver.
 */
MOTOR_DRIVER_PWM_SW::POSITION  MOTOR_DRIVER_PWM_SW::GetPositionCurrent() const
{
  return POSITION{0};
}

/**
 * @brief Retrieves the current current (amperage) of the PWM software motor driver.
 *
 * This function retrieves the current current (amperage) of the PWM software motor driver. If a
 * current sensor is available in the setup, it is used to obtain the current value.
 *
 * @return The current current value of the motor driver (in milliamperes, mA).
 */
MOTOR_DRIVER_PWM_SW::CURRENT MOTOR_DRIVER_PWM_SW::GetCurrent_mA() const
{
  const auto* const cpcoSetup = GetSetup();

  if (cpcoSetup && cpcoSetup->m_cpoCurrentSensor)
  {
    const auto* const cpcoSensor = (SENSOR_CURRENT*)cpcoSetup->m_cpoCurrentSensor;

    return CURRENT{cpcoSensor->Get_Current_mA()};
  }

  return CURRENT{0.0F};
}
/*---------------------------- Private functions -----------------------------*/
/**
 * @brief Initializes the power control pin for the PWM software motor driver.
 *
 * This function initializes the power control pin for the PWM software motor driver if it is
 * available in the setup configuration. The power control pin is configured as per the setup.
 */
void MOTOR_DRIVER_PWM_SW::PowerPinInit()
{
  const auto* const cpcoSetup = GetSetup();

  if (cpcoSetup && cpcoSetup->m_cpcPinDrv_Power)
  {
    GPIO_Init(*cpcoSetup->m_cpcPinDrv_Power);
  }
}

/**
 * @brief Deinitializes the power control pin for the PWM software motor driver.
 *
 * This function deinitializes the power control pin for the PWM software motor driver if it is
 * available in the setup configuration. The power control pin is released and its resources are
 * cleaned up.
 */
void MOTOR_DRIVER_PWM_SW::PowerPinDenit()
{
  const auto* const cpcoSetup = GetSetup();

  if (cpcoSetup && cpcoSetup->m_cpcPinDrv_Power)
  {
    GPIO_Deinit(*cpcoSetup->m_cpcPinDrv_Power);
  }
}

/**
 * @brief Enables power for the PWM software motor driver.
 *
 * This function activates power for the PWM software motor driver by setting the power control
 * pin to an active state. If the power control pin is available in the setup configuration, it is
 * used to enable power.
 */
void MOTOR_DRIVER_PWM_SW::PowerEnable()
{
  const auto* const cpcoSetup = GetSetup();

  if (cpcoSetup && cpcoSetup->m_cpcPinDrv_Power)
  {
    GPIO_SetActive(*cpcoSetup->m_cpcPinDrv_Power);
  }
}

/**
 * @brief Disables power for the PWM software motor driver.
 *
 * This function deactivates power for the PWM software motor driver by setting the power control
 * pin to an inactive state. If the power control pin is available in the setup configuration, it
 * is used to disable power.
 */
void MOTOR_DRIVER_PWM_SW::PowerDisable()
{
  const auto* const cpcoSetup = GetSetup();

  if (cpcoSetup && cpcoSetup->m_cpcPinDrv_Power)
  {
    GPIO_SetInactive(*cpcoSetup->m_cpcPinDrv_Power);
  }
}

