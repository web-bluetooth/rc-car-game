

#include <stdint.h>
#include "read_set_bit.h"

uint8_t bit_mask[] = {  BIT_MASK_0, 
                        BIT_MASK_1, 
                        BIT_MASK_2, 
                        BIT_MASK_3, 
                        BIT_MASK_4, 
                        BIT_MASK_5, 
                        BIT_MASK_6, 
                        BIT_MASK_7
                     };

uint8_t read_bit( uint8_t * bit_p, uint8_t byte_offset, uint8_t bit_offset ) 
{
    return (bit_p[byte_offset] & bit_mask[bit_offset]);
}

uint8_t read_byte( uint8_t * bit_p, uint8_t byte_offset) 
{
    return bit_p[byte_offset];
}
