AfterPlanted.bombedRun = function (fromX, fromY, currentMap) {
    // run 1 step
    if(AfterPlanted.checkWalk(fromX-1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX-1, fromY+1, currentMap)) {
            return '32'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY-1, currentMap)) {
            return '31'
        }
    }

    if(AfterPlanted.checkWalk(fromX+1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY+1, currentMap)) {
            return '42'
        }
        if(AfterPlanted.checkWalk(fromX+1, fromY-1, currentMap)) {
            return '41'
        }
    }

    if(AfterPlanted.checkWalk(fromX, fromY-1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY-1, currentMap)) {
            return '14'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY-1, currentMap)) {
            return '13'
        }
    }

    if(AfterPlanted.checkWalk(fromX, fromY+1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY+1, currentMap)) {
            return '24'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY+1, currentMap)) {
            return '23'
        }
    }



    // run 2 step
    if(AfterPlanted.checkWalk(fromX-1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX-2, fromY, currentMap)){
            if(AfterPlanted.checkWalk(fromX-2, fromY+1, currentMap)) {
                return '332'
            }
            if(AfterPlanted.checkWalk(fromX-2, fromY-1, currentMap)) {
                return '331'
            }
        }

    }
    if(AfterPlanted.checkWalk(fromX+1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+2, fromY, currentMap)){
            if(AfterPlanted.checkWalk(fromX+2, fromY+1, currentMap)) {
                return '442'
            }
            if(AfterPlanted.checkWalk(fromX+2, fromY-1, currentMap)) {
                return '441'
            }
        }
    }

    if(AfterPlanted.checkWalk(fromX, fromY-1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX, fromY-2, currentMap)) {
            if(AfterPlanted.checkWalk(fromX+1, fromY-2, currentMap)) {
                return '114'
            }
            if(AfterPlanted.checkWalk(fromX-1, fromY-2, currentMap)) {
                return '113'
            }
        }
    }

    if(AfterPlanted.checkWalk(fromX, fromY+1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX, fromY+2, currentMap)) {
            if(AfterPlanted.checkWalk(fromX+1, fromY+2, currentMap)) {
                return '224'
            }
            if(AfterPlanted.checkWalk(fromX-1, fromY+2, currentMap)) {
                return '223'
            }
        }
    }

    // run 3 step
    if(AfterPlanted.checkWalk(fromX-1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX-2, fromY, currentMap)) {
            if(AfterPlanted.checkWalk(fromX-3, fromY, currentMap)) {
                if(AfterPlanted.checkWalk(fromX-3, fromY+1, currentMap)) {
                    return '3332'
                }
                if(AfterPlanted.checkWalk(fromX-3, fromY-1, currentMap)) {
                    return '3331'
                }
            }
        }
    }

    if(AfterPlanted.checkWalk(fromX+1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+2, fromY, currentMap)) {
            if(AfterPlanted.checkWalk(fromX+3, fromY, currentMap)) {
                if(AfterPlanted.checkWalk(fromX+3, fromY+1, currentMap)) {
                    return '4442'
                }
                if(AfterPlanted.checkWalk(fromX+3, fromY-1, currentMap)) {
                    return '4441'
                }
            }
        }
    }

    if(AfterPlanted.checkWalk(fromX, fromY-1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX, fromY-2, currentMap)) {
            if(AfterPlanted.checkWalk(fromX, fromY-3, currentMap)) {
                if(AfterPlanted.checkWalk(fromX+1, fromY-3, currentMap)) {
                    return '1114'
                }
                if(AfterPlanted.checkWalk(fromX-1, fromY-3, currentMap)) {
                    return '1113'
                }
            }
        }
    }

    if(AfterPlanted.checkWalk(fromX, fromY+1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX, fromY+2, currentMap)) {
            if(AfterPlanted.checkWalk(fromX, fromY+3, currentMap)) {
                if(AfterPlanted.checkWalk(fromX+1, fromY+3, currentMap)) {
                    return '2224'
                }
                if(AfterPlanted.checkWalk(fromX-1, fromY+3, currentMap)) {
                    return '2223'
                }
            }
        }
    }


    // run 4 step
    if(AfterPlanted.checkWalk(fromX-1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX-4, fromY+1, currentMap)) {
            return '33332'
        }
        if(AfterPlanted.checkWalk(fromX-4, fromY-1, currentMap)) {
            return '33331'
        }
    }
    if(AfterPlanted.checkWalk(fromX+1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+4, fromY+1, currentMap)) {
            return '44442'
        }
        if(AfterPlanted.checkWalk(fromX+4, fromY-1, currentMap)) {
            return '44441'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY-1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY-4, currentMap)) {
            return '11114'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY-4, currentMap)) {
            return '11113'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY+1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY+4, currentMap)) {
            return '22224'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY+4, currentMap)) {
            return '22223'
        }
    }

    // run 5 step
    if(AfterPlanted.checkWalk(fromX-1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX-5, fromY+1, currentMap)) {
            return '333332'
        }
        if(AfterPlanted.checkWalk(fromX-5, fromY-1, currentMap)) {
            return '333331'
        }
    }
    if(AfterPlanted.checkWalk(fromX+1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+5, fromY+1, currentMap)) {
            return '444442'
        }
        if(AfterPlanted.checkWalk(fromX+5, fromY-1, currentMap)) {
            return '444441'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY-1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY-5, currentMap)) {
            return '111114'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY-5, currentMap)) {
            return '111113'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY+1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY+5, currentMap)) {
            return '222224'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY+5, currentMap)) {
            return '222223'
        }
    }

    // run 6 step
    if(AfterPlanted.checkWalk(fromX-1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX-6, fromY+1, currentMap)) {
            return '3333332'
        }
        if(AfterPlanted.checkWalk(fromX-6, fromY-1, currentMap)) {
            return '3333331'
        }
    }
    if(AfterPlanted.checkWalk(fromX+1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+6, fromY+1, currentMap)) {
            return '4444442'
        }
        if(AfterPlanted.checkWalk(fromX+6, fromY-1, currentMap)) {
            return '4444441'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY-1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY-6, currentMap)) {
            return '1111114'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY-6, currentMap)) {
            return '1111113'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY+1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY+6, currentMap)) {
            return '2222224'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY+6, currentMap)) {
            return '2222223'
        }
    }

    // run 7 step
    if(AfterPlanted.checkWalk(fromX-1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX-7, fromY+1, currentMap)) {
            return '33333332'
        }
        if(AfterPlanted.checkWalk(fromX-7, fromY-1, currentMap)) {
            return '33333331'
        }
    }
    if(AfterPlanted.checkWalk(fromX+1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+7, fromY+1, currentMap)) {
            return '44444442'
        }
        if(AfterPlanted.checkWalk(fromX+7, fromY-1, currentMap)) {
            return '44444441'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY-1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY-7, currentMap)) {
            return '11111114'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY-7, currentMap)) {
            return '11111113'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY+1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY+7, currentMap)) {
            return '22222224'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY+7, currentMap)) {
            return '22222223'
        }
    }

    // run 8 step
    if(AfterPlanted.checkWalk(fromX-1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX-8, fromY+1, currentMap)) {
            return '333333332'
        }
        if(AfterPlanted.checkWalk(fromX-8, fromY-1, currentMap)) {
            return '333333331'
        }
    }
    if(AfterPlanted.checkWalk(fromX+1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+8, fromY+1, currentMap)) {
            return '444444442'
        }
        if(AfterPlanted.checkWalk(fromX+8, fromY-1, currentMap)) {
            return '444444441'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY-1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY-8, currentMap)) {
            return '111111114'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY-8, currentMap)) {
            return '111111113'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY+1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY+8, currentMap)) {
            return '222222224'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY+8, currentMap)) {
            return '222222223'
        }
    }

    // run 9 step
    if(AfterPlanted.checkWalk(fromX-1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX-9, fromY+1, currentMap)) {
            return '3333333332'
        }
        if(AfterPlanted.checkWalk(fromX-9, fromY-1, currentMap)) {
            return '3333333331'
        }
    }
    if(AfterPlanted.checkWalk(fromX+1, fromY, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+9, fromY+1, currentMap)) {
            return '4444444442'
        }
        if(AfterPlanted.checkWalk(fromX+9, fromY-1, currentMap)) {
            return '4444444441'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY-1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY-9, currentMap)) {
            return '1111111114'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY-9, currentMap)) {
            return '1111111113'
        }
    }
    if(AfterPlanted.checkWalk(fromX, fromY+1, currentMap)) {
        if(AfterPlanted.checkWalk(fromX+1, fromY+9, currentMap)) {
            return '2222222224'
        }
        if(AfterPlanted.checkWalk(fromX-1, fromY+9, currentMap)) {
            return '2222222223'
        }
    }
}