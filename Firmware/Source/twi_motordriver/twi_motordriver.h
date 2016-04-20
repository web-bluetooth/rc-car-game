#include <stdint.h>
#include "nrf_drv_twi.h"
#include "nrf_delay.h"


// Define pins for I2C-communication with the motor shield
#define SDA_MOTOR_PIN         26
#define SCL_MOTOR_PIN         27

// Defines the LED used when the driver writes to the channel.
#define WRITE_LED             19

// Define the slave address
#define ADR_MOTOR_SLAVE       0x60


// Define addresses for the motor units and the PWM pins associated with the motors
#define ADR_MOTOR_1 	0x26
#define ADR_MOTOR_2 	0x3A
#define ADR_MOTOR_3 	0x0E
#define ADR_MOTOR_4 	0x22
#define PWM_1_PIN_1 	0x2A
#define PWM_1_PIN_2 	0x2E
#define PWM_2_PIN_1 	0x32
#define PWM_2_PIN_2 	0x36
#define PWM_3_PIN_1 	0x16
#define PWM_3_PIN_2 	0x12
#define PWM_4_PIN_1 	0x1A
#define PWM_4_PIN_2 	0x1E


// Define the byte offset to the byte in motor_data that contains data about the speed for each motor
#define BYTE_M_1_SP     10
#define BYTE_M_2_SP     11
#define BYTE_M_3_SP     12
#define BYTE_M_4_SP     13


// Define the byte offset to the byte in motor_data that contains data about the direction for each motor
#define BYTE_M_1_DIR    14
#define BYTE_M_2_DIR    15
#define BYTE_M_3_DIR    16
#define BYTE_M_4_DIR    17


// Set initial motor direction to 0
#define MOTOR_INIT_DIR  0


// Define values for standard packages sent to the motor shield
#define DUMMY_PACKAGE  	0x00
#define LOW_PACKAGE     0x00
#define HIGH_PACKAGE    0x10



// Prototypes for functions used in twi_motordriver.c
void twi_motordriver_init(void);
void twi_init_motorshield(void);
void twi_clear_motorshield(void);

void twi_set_motor(uint8_t * motor_data);
void twi_set_speed(uint8_t motor_adr, uint8_t motor_speed);
void twi_set_motor_dir(uint8_t pin_1, uint8_t pin_2, uint8_t motor_offset, uint8_t new_motor_dir);


// Struct to hold information about a motor connected to the motor shield
typedef struct 
{
    uint8_t   adr;                // The motor's address within the motor shield
    uint8_t   pwm_pin_1;          // Address to the PWM pin 1 associated with the motor
    uint8_t   pwm_pin_2;          // Address to the PWM pin 2 associated with the motor
    uint8_t   byte_index_sp;      // Index for the byte within the received array from the event handler that holds information about the speed
    uint8_t   byte_index_dir;     // Index for the byte within the received array from the event handler that holds information about the direction
    uint8_t   direction;          // The motor's current direction of rotation
} motor_t;
