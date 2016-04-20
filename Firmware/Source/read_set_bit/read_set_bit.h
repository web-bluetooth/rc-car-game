

#include <stdint.h>

#define BIT_MASK_0		128
#define BIT_MASK_1		64
#define BIT_MASK_2		32
#define BIT_MASK_3		16
#define BIT_MASK_4		8
#define BIT_MASK_5		4
#define BIT_MASK_6		2
#define BIT_MASK_7		1


uint8_t read_bit(  uint8_t * bit_p, uint8_t byte_offset, uint8_t bit_offset );
uint8_t read_byte( uint8_t * bit_p, uint8_t byte_offset);

