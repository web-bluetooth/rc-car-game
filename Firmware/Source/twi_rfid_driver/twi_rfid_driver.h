#include <stdint.h>
#include "nrf_drv_twi.h"
#include "nrf_delay.h"
#include "nrf_drv_timer.h"

// Define pins for I2C-communication with the RFID-module
#define SDA_RFID_PIN         24
#define SCL_RFID_PIN         25

#define READ_PIN             20

// Define the slave address
#define ADR_RFID_SLAVE       0x24

//Defines the LED used for RFID-reading
#define READ_LED            20

// Prototypes for functions used in twi_rfid_driver.c

void read_rfid_shield(void);
uint8_t rfid_read_event_handler(void);
void twi_rfid_init(void);