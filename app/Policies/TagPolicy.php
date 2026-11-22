<?php

namespace App\Policies;

/**
 * Reference data follows the data rule like everything else: `view data` reads
 * it, the Manager of Data changes it ({@see DataPolicy}).
 */
class TagPolicy extends DataPolicy {}
