<?php
require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::create(__DIR__);
$dotenv->load();

$faker = Faker\Factory::create();

function main()
{
  \Hawk\HawkCatcher::instance($_ENV['CATCHER_TOKEN'], $_ENV['CATCHER_URL']);
  \Hawk\HawkCatcher::enableHandlers();
  $log = new Monolog\Logger('name');
  $ind = rand(0, 9);

  try {
    switch ($ind) {
      case 0:
        {
          // Simple Exception
          throw new Exception(get_random_text(), 1);
          break;
        }
      case 1:
        {
          // Simple Error
          throw new Error(get_random_text());
          break;
        }
      case 2:
        {
          // DivisionByZeroError
          $inf = 1 % 0;
          break;
        }
      case 3:
        {
          // ArithmeticError
          $i = rand(0, 10000);
          $x = $i << -1;
          break;
        }
      case 4:
        {
          throw new ParseError(get_random_text());
          break;
        }
      case 5:
        {
          // TypeError
          test_type_error(get_random_text());
        }
      case 6:
        {
          // Custom Exception
          throw new MyException(get_random_text());
        }
      case 7:
        {
          // Simple OutOfRangeException
          throw new OutOfRangeException(get_random_text());
        }
      case 8:
        {
          // Simple RuntimeException
          throw new RuntimeException(get_random_text());
        }
      case 9:
        {
          // Simple ErrorException
          throw new ErrorException(get_random_text());
        }
    }
  } catch (Throwable $e) {
    \Hawk\HawkCatcher::catchException($e);
  }
}

$comand = isset($argv[1]) ? $argv[1] : 'once';

if ($comand == 'once') {
  main();
} elseif ($comand == 'interval') {
  $sec = isset($argv[2]) ? (int)$argv[2] : 1;
  echo var_dump($sec);
  setInterval(function () {
    main();
  }, $sec);
}

function setInterval($f, $seconds)
{
  while (true) {
    $f();
    sleep($seconds);
  }
}

function test_type_error(int $val)
{
  return $val;
}

function get_random_text() {
  global $faker;
  return $faker->text(20);
}

class MyException extends Exception {}
?>
