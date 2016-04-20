#include <stdint.h>
#include "nrf_drv_twi.h"
#include "nrf_delay.h"
#include "twi_motordriver.h"
#include "app_error.h"
#include "nrf_gpio.h"
#include "read_set_bit.h"

// Define the TWI-channel instance.
static const nrf_drv_twi_t twi_motor = NRF_DRV_TWI_INSTANCE(0);

// Define motor_t array with information about all motors
motor_t motor[] =  {
                        {ADR_MOTOR_1, PWM_1_PIN_1, PWM_1_PIN_2, BYTE_M_1_SP, BYTE_M_1_DIR, MOTOR_INIT_DIR},
                        {ADR_MOTOR_2, PWM_2_PIN_1, PWM_2_PIN_2, BYTE_M_2_SP, BYTE_M_2_DIR, MOTOR_INIT_DIR},
                        {ADR_MOTOR_3, PWM_3_PIN_1, PWM_3_PIN_2, BYTE_M_3_SP, BYTE_M_3_DIR, MOTOR_INIT_DIR},
                        {ADR_MOTOR_4, PWM_4_PIN_1, PWM_4_PIN_2, BYTE_M_4_SP, BYTE_M_4_DIR, MOTOR_INIT_DIR}
                   };



/** @brief  Function to set up the TWI channel for communication
 *
 */
void twi_motordriver_init(void)
{
   const nrf_drv_twi_config_t twi_motor_config = {
      .scl                = SCL_MOTOR_PIN,
      .sda                = SDA_MOTOR_PIN,
      .frequency          = NRF_TWI_FREQ_100K,
      .interrupt_priority = TWI0_CONFIG_IRQ_PRIORITY
   };

   // Initialize the TWI channel
   nrf_drv_twi_init(&twi_motor, &twi_motor_config, NULL, NULL);
   
   // Enable the TWI channel
   nrf_drv_twi_enable(&twi_motor);
   
   // Initialize the motor shield
   twi_init_motorshield();
};


/** @brief  Function to set up the motor shield for communication
 *
 */

void twi_init_motorshield(void){

        // Set the required initialization packages
        uint8_t initPackage1[] = {DUMMY_PACKAGE, DUMMY_PACKAGE};                // Initial packages before communication setup
        uint8_t initPackage2[] = {DUMMY_PACKAGE};

        uint8_t initPackageAfterRead[4][2]= {{0x00, 0x10},                      // Packages after communication setup
                                             {0xFE, 0x06},
                                             {DUMMY_PACKAGE, DUMMY_PACKAGE},
                                             {0x00,0xA1}}; 
    
    // Send the initialization packages                                                                     
    nrf_drv_twi_tx(&twi_motor, ADR_MOTOR_SLAVE, initPackage1, sizeof(initPackage1), false); // Dummy package 0x00 0x00 checks the TWI channel
    nrf_drv_twi_tx(&twi_motor, ADR_MOTOR_SLAVE, initPackage2, sizeof(initPackage2), false); // Dummy package 0x00 is sent to the motor shield
   

    // Wait for response from the motor shield that confirms the communication channel is working
    // ** If no motor shield is attached to the DK, the program will be stuck in infinite loop at this point
    uint8_t checkRxData = 0x01;
    do{
        nrf_drv_twi_rx(&twi_motor, ADR_MOTOR_SLAVE, &checkRxData, 1);
        nrf_delay_us(5);
    }while(checkRxData != 0x00);    // If checkRxData becomes 0x00, the motor shield is signaling that the TWI channel works
    

    // Send values to the motor shield for further communication set up
    // These packages contains information about frequency and other settings to make the channel work
    for (uint8_t i = 0; i < 4; i++){            
           nrf_drv_twi_tx(&twi_motor, ADR_MOTOR_SLAVE, initPackageAfterRead[i], sizeof(initPackageAfterRead[i]), false);
    }    
    

    // Communication is now set up with the motor shield. Call twi_clear_motorshield to clear all values for motors and PWM modules on the shield
    nrf_delay_us(20);
    twi_clear_motorshield();
};

/** @brief  Function to clear all values in the motor shield and sets them to 0x00
 *  
 */
void twi_clear_motorshield(void){ 

    // Standard package to be sent to every unit
    uint8_t dataPackage[] = {NULL, NULL, NULL, NULL, NULL}; 
    
    // List containing addresses to every motor associated unit on the motor shield
    uint8_t listUnit[] = {  0x06, 0x0A, ADR_MOTOR_3, PWM_3_PIN_2, 
                            PWM_3_PIN_1, PWM_4_PIN_2, PWM_4_PIN_1, 
                            ADR_MOTOR_4,ADR_MOTOR_1, PWM_1_PIN_1, 
                            PWM_1_PIN_2, PWM_2_PIN_1, PWM_2_PIN_2, 
                            ADR_MOTOR_2, 0x3E, 0x42};
    
    // Send the NULL packages to the units
    for(uint8_t i = 0; i < sizeof(listUnit); i++){
        dataPackage[0] = listUnit[i];
        nrf_drv_twi_tx(&twi_motor, ADR_MOTOR_SLAVE, dataPackage, sizeof(dataPackage), false);
        nrf_delay_us(5);    
    }        
};


/** @brief  Function to set new parameters to the 4 motor units on the motor shield
 *  
 *  @param  motor_data    pointer to array that holds information about speed and direction for the motors
 */
void twi_set_motor(uint8_t * motor_data){
    
    nrf_gpio_pin_clear(WRITE_LED);
    for(uint8_t m = 0; m < 4; m++) 
    {
        twi_set_motor_dir(motor[m].pwm_pin_1, motor[m].pwm_pin_2, m, motor_data[motor[m].byte_index_dir]);
        twi_set_speed(motor[m].adr, motor_data[motor[m].byte_index_sp]);
    }
    nrf_gpio_pin_set(WRITE_LED);    
};



/** @brief  Function to send new parameters for speed to the motors
 *  
 *  @param  motor_adr         the motor's address
 *  @param  motor_speed       new speed to be sent to the motor
 */
void twi_set_speed(uint8_t motor_adr, uint8_t motor_speed) 
{ 
    // Standard packages 
    uint8_t data_package[] = {motor_adr, DUMMY_PACKAGE, DUMMY_PACKAGE, NULL, NULL};

    // Set the bytes that varies from motor to motor; address and speed
    data_package[3] = (motor_speed % 16) << 4;
    data_package[4] = (motor_speed / 16);
    
    // Send the package with new value for speed
    nrf_drv_twi_tx(&twi_motor, ADR_MOTOR_SLAVE, data_package, sizeof(data_package), false);
}


/** @brief  Function to send new parameters for direction to the motors
 *  
 *  @param  adr_pin_1         address to PWM pin 1
 *  @param  adr_pin_2         address to PWM pin 2
 *  @param  motor_index       the motor struct's index in the motor array
 *  @param  new_motor_dir     the new direction of rotation - 0 or 1
 */
void twi_set_motor_dir(uint8_t adr_pin_1, uint8_t adr_pin_2, uint8_t motor_index, uint8_t new_motor_dir) 
{
    // Send new value for direction only if it's different from previous direction
    if(new_motor_dir != motor[motor_index].direction)
    {
        // Both pins for direction has to be 0 before new direction is set. They may never both be 1 at the same time.
        if(motor[motor_index].direction == 0)
        {
            uint8_t data_package_set_low[] = {adr_pin_2, DUMMY_PACKAGE, LOW_PACKAGE, DUMMY_PACKAGE, DUMMY_PACKAGE};
            uint8_t data_package_set_high[] = {adr_pin_1, DUMMY_PACKAGE, HIGH_PACKAGE, DUMMY_PACKAGE, DUMMY_PACKAGE};
            nrf_drv_twi_tx(&twi_motor, ADR_MOTOR_SLAVE, data_package_set_low, sizeof(data_package_set_low), false);
            nrf_delay_us(5);
            nrf_drv_twi_tx(&twi_motor, ADR_MOTOR_SLAVE, data_package_set_high, sizeof(data_package_set_high), false);
        }
        else 
        {
            uint8_t data_package_set_low[] = {adr_pin_1, DUMMY_PACKAGE, LOW_PACKAGE, DUMMY_PACKAGE, DUMMY_PACKAGE};
            uint8_t data_package_set_high[] = {adr_pin_2, DUMMY_PACKAGE, HIGH_PACKAGE, DUMMY_PACKAGE, DUMMY_PACKAGE};
            nrf_drv_twi_tx(&twi_motor, ADR_MOTOR_SLAVE, data_package_set_low, sizeof(data_package_set_low), false);
            nrf_delay_us(5);
            nrf_drv_twi_tx(&twi_motor, ADR_MOTOR_SLAVE, data_package_set_high, sizeof(data_package_set_high), false);
        }

        // Save the new direction to the motor struct
        motor[motor_index].direction = new_motor_dir;
    }
}
